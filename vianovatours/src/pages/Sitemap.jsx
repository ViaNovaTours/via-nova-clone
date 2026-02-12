import React, { useEffect } from "react";

export default function Sitemap() {
  useEffect(() => {
    // Redirect to the sitemap.xml function
    const hostname = window.location.hostname;
    window.location.href = `/functions/generateSitemap?domain=${hostname}`;
  }, []);

  return null;
}