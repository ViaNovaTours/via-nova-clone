import React from "react";
import DomainRouter from "../components/tour-landing/DomainRouter";

// This page should NOT use Layout - it's public-facing
TourLanding.useLayout = false;

export default function TourLanding() {
  return <DomainRouter />;
}