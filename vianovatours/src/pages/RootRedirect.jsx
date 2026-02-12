import React, { useEffect } from "react";
import { HelmetProvider } from "react-helmet-async";

// Wrapper to provide HelmetProvider for all tour pages
export default function RootRedirect({ children }) {
  return (
    <HelmetProvider>
      {children}
    </HelmetProvider>
  );
}