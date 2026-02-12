import React, { useEffect } from "react";

export default function Robots() {
  useEffect(() => {
    // Redirect to the robots.txt function
    const hostname = window.location.hostname;
    window.location.href = `/functions/generateRobotsTxt?domain=${hostname}`;
  }, []);

  return null;
}