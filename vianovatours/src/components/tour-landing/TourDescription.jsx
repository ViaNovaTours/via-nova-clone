import React from "react";
import ReactMarkdown from "react-markdown";

export default function TourDescription({ description }) {
  return (
    <div className="py-16 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="prose prose-lg max-w-none text-slate-700">
          <ReactMarkdown>{description}</ReactMarkdown>
        </div>
      </div>
    </div>
  );
}