import { env } from "@/lib/deployment-config";
import { getSupabaseClient } from "@/lib/supabaseClient";

const DEFAULT_ENTITY_TABLE_CANDIDATES = {
  Order: ["orders", "order", "Order"],
  Tour: ["tours", "tour", "Tour"],
  TicketType: ["ticket_types", "ticket_type", "TicketType"],
  WooCommerceCredentials: [
    "woo_commerce_credentials",
    "woocommerce_credentials",
    "WooCommerceCredentials",
  ],
  TourLandingPage: ["tour_landing_pages", "tour_landing_page", "TourLandingPage"],
  AdSpend: ["ad_spend", "ad_spends", "AdSpend"],
  MonthlyCosts: ["monthly_costs", "monthly_cost", "MonthlyCosts"],
};

const tableResolutionCache = new Map();
const DEFAULT_PAGE_SIZE = 1000;

const toSnakeCase = (value) =>
  String(value)
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();

const removeUndefined = (value) =>
  Object.fromEntries(
    Object.entries(value || {}).filter(([, entry]) => entry !== undefined)
  );

const parseSortConfig = (sortBy) => {
  if (!sortBy || typeof sortBy !== "string") {
    return null;
  }
  const desc = sortBy.startsWith("-");
  return {
    column: desc ? sortBy.slice(1) : sortBy,
    ascending: !desc,
  };
};

const normalizeLimit = (limit) => {
  if (typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0) {
    return null;
  }
  return Math.floor(limit);
};

const normalizeSupabaseError = (error) => {
  const wrapped = new Error(error?.message || "Database operation failed");
  wrapped.status = error?.status;
  wrapped.code = error?.code;
  wrapped.details = error?.details;
  wrapped.hint = error?.hint;
  return wrapped;
};

const isMissingTableError = (error) => {
  const message = `${error?.message || ""} ${error?.details || ""}`;
  return (
    error?.code === "42P01" ||
    /relation .* does not exist|could not find the table|schema cache/i.test(
      message
    )
  );
};

const getTableCandidates = (entityName) => {
  const envTable = env.tableMap?.[entityName];
  const defaults = DEFAULT_ENTITY_TABLE_CANDIDATES[entityName] || [];
  const heuristics = [
    toSnakeCase(entityName),
    `${toSnakeCase(entityName)}s`,
    entityName,
  ];
  return [envTable, ...defaults, ...heuristics].filter(
    (candidate, index, list) =>
      Boolean(candidate) && list.indexOf(candidate) === index
  );
};

const runWithTableFallback = async (entityName, executor) => {
  const client = getSupabaseClient();
  const resolved = tableResolutionCache.get(entityName);
  const candidates = getTableCandidates(entityName);
  const orderedCandidates = resolved
    ? [resolved, ...candidates.filter((candidate) => candidate !== resolved)]
    : candidates;

  let lastMissingTableError = null;

  for (const tableName of orderedCandidates) {
    const { data, error } = await executor(client.from(tableName), tableName);

    if (error) {
      if (isMissingTableError(error)) {
        lastMissingTableError = error;
        continue;
      }
      throw normalizeSupabaseError(error);
    }

    tableResolutionCache.set(entityName, tableName);
    return data;
  }

  const joinedCandidates = orderedCandidates.join(", ");
  const missingError = normalizeSupabaseError(lastMissingTableError || {});
  throw new Error(
    `No Supabase table found for entity "${entityName}". Tried: ${joinedCandidates}. Last error: ${missingError.message}`
  );
};

const runPagedSelect = async ({
  tableName,
  limit,
  buildQuery,
}) => {
  const client = getSupabaseClient();
  const normalizedLimit = normalizeLimit(limit);
  const rows = [];
  let offset = 0;

  while (true) {
    if (normalizedLimit !== null && rows.length >= normalizedLimit) {
      break;
    }

    const remaining = normalizedLimit === null
      ? DEFAULT_PAGE_SIZE
      : Math.min(DEFAULT_PAGE_SIZE, normalizedLimit - rows.length);
    const upperBound = offset + remaining - 1;

    let query = buildQuery(client.from(tableName));
    query = query.range(offset, upperBound);

    const { data, error } = await query;
    if (error) {
      return { data: null, error };
    }

    const pageRows = Array.isArray(data) ? data : [];
    rows.push(...pageRows);

    if (pageRows.length < remaining) {
      break;
    }

    offset += remaining;
  }

  return {
    data: normalizedLimit === null ? rows : rows.slice(0, normalizedLimit),
    error: null,
  };
};

export const createEntityApi = (entityName) => ({
  async list(sortBy, limit) {
    const sortConfig = parseSortConfig(sortBy);
    return runWithTableFallback(entityName, async (_queryBuilder, tableName) =>
      runPagedSelect({
        tableName,
        limit,
        buildQuery: (fromBuilder) => {
          let query = fromBuilder.select("*");
          if (sortConfig) {
            query = query.order(sortConfig.column, {
              ascending: sortConfig.ascending,
            });
          }
          return query;
        },
      })
    );
  },

  async filter(filters = {}, sortBy, limit) {
    const sortConfig = parseSortConfig(sortBy);
    return runWithTableFallback(entityName, async (_queryBuilder, tableName) =>
      runPagedSelect({
        tableName,
        limit,
        buildQuery: (fromBuilder) => {
          let query = fromBuilder.select("*");
          for (const [key, value] of Object.entries(filters || {})) {
            if (Array.isArray(value)) {
              query = query.in(key, value);
            } else if (value === null) {
              query = query.is(key, null);
            } else {
              query = query.eq(key, value);
            }
          }
          if (sortConfig) {
            query = query.order(sortConfig.column, {
              ascending: sortConfig.ascending,
            });
          }
          return query;
        },
      })
    );
  },

  async get(id) {
    return runWithTableFallback(entityName, async (queryBuilder) =>
      queryBuilder.select("*").eq("id", id).maybeSingle()
    );
  },

  async create(payload) {
    const safePayload = removeUndefined(payload);
    return runWithTableFallback(entityName, async (queryBuilder) =>
      queryBuilder.insert(safePayload).select("*").single()
    );
  },

  async update(id, payload) {
    const safePayload = removeUndefined(payload);
    return runWithTableFallback(entityName, async (queryBuilder) =>
      queryBuilder.update(safePayload).eq("id", id).select("*").maybeSingle()
    );
  },

  async delete(id) {
    return runWithTableFallback(entityName, async (queryBuilder) =>
      queryBuilder.delete().eq("id", id).select("id").maybeSingle()
    );
  },
});

