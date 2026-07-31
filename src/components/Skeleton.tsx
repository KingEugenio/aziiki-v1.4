import React from "react";

interface SkeletonProps {
  key?: React.Key;
  width?: string | number;
  height?: string | number;
  circle?: boolean;
  className?: string;
  animate?: "shimmer" | "pulse" | "none";
  borderRadius?: string;
  style?: React.CSSProperties;
}

export function Skeleton({
  width,
  height,
  circle = false,
  className = "",
  animate = "shimmer",
  borderRadius,
  style
}: SkeletonProps) {
  const animationClass =
    animate === "shimmer"
      ? "shimmer-bg"
      : animate === "pulse"
      ? "skeleton-pulse animate-pulse"
      : "bg-slate-200";

  const customStyle: React.CSSProperties = {
    width: width !== undefined ? width : "100%",
    height: height !== undefined ? height : "1rem",
    borderRadius: circle ? "50%" : borderRadius || "8px",
    ...style
  };

  return (
    <div
      role="status"
      aria-label="Loading content"
      aria-busy="true"
      className={`inline-block ${animationClass} ${className}`}
      style={customStyle}
    >
      <span className="sr-only">Loading...</span>
    </div>
  );
}

// Composite Skeleton 1: Standard Dashboard Stats Cards
export function SkeletonDashboard() {
  return (
    <div className="space-y-6 w-full text-left" id="skeleton-dashboard">
      {/* Welcome Message Skeleton */}
      <div className="space-y-2">
        <Skeleton width="40%" height="2rem" />
        <Skeleton width="60%" height="1rem" />
      </div>

      {/* Grid of Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-sm"
          >
            <div className="flex items-center justify-between">
              <Skeleton width="50%" height="0.875rem" />
              <Skeleton width="1.5rem" height="1.5rem" circle />
            </div>
            <Skeleton width="75%" height="1.75rem" />
            <div className="flex items-center gap-1">
              <Skeleton width="20%" height="0.75rem" />
              <Skeleton width="40%" height="0.75rem" />
            </div>
          </div>
        ))}
      </div>

      {/* Two-column layout: Main Chart & Side Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1.5">
              <Skeleton width="120px" height="1rem" />
              <Skeleton width="200px" height="0.75rem" />
            </div>
            <Skeleton width="80px" height="2rem" className="rounded-xl" />
          </div>
          <Skeleton height="250px" className="rounded-xl" />
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
          <Skeleton width="100px" height="1rem" />
          <div className="space-y-3.5">
            {[1, 2, 3, 4].map((idx) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2.5 flex-1">
                  <Skeleton width="2rem" height="2rem" circle />
                  <div className="space-y-1 flex-1">
                    <Skeleton width="60%" height="0.875rem" />
                    <Skeleton width="40%" height="0.75rem" />
                  </div>
                </div>
                <Skeleton width="50px" height="0.875rem" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Composite Skeleton 2: Table / Spreadsheet Grid Loader
export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden p-4 space-y-4 w-full text-left" id="skeleton-table">
      {/* Top Filter and Search Skeleton */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <Skeleton width="250px" height="2.25rem" className="rounded-xl" />
        <div className="flex gap-2 w-full sm:w-auto">
          <Skeleton width="100px" height="2.25rem" className="rounded-xl" />
          <Skeleton width="120px" height="2.25rem" className="rounded-xl" />
        </div>
      </div>

      {/* Spreadsheet / Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        {/* Header Row */}
        <div className="grid grid-cols-12 bg-slate-50 p-3.5 border-b border-slate-200">
          {Array.from({ length: cols }).map((_, colIdx) => (
            <div
              key={colIdx}
              className={`${
 colIdx === 0
 ? "col-span-4"
 : colIdx === cols - 1
 ? "col-span-3 text-right"
 : "col-span-2 text-center"
 }`}
            >
              <Skeleton width="60%" height="0.75rem" className="mx-auto inline-block align-middle" />
            </div>
          ))}
        </div>

        {/* Data Rows */}
        <div className="divide-y divide-slate-100">
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <div
              key={rowIdx}
              className="grid grid-cols-12 p-4 items-center"
              style={{ animationDelay: `${rowIdx * 50}ms` }}
            >
              {Array.from({ length: cols }).map((_, colIdx) => (
                <div
                  key={colIdx}
                  className={`${
 colIdx === 0
 ? "col-span-4"
 : colIdx === cols - 1
 ? "col-span-3 text-right"
 : "col-span-2 text-center"
 }`}
                >
                  {colIdx === 0 ? (
                    <div className="flex items-center gap-3">
                      <Skeleton width="1.75rem" height="1.75rem" circle />
                      <div className="space-y-1 flex-1">
                        <Skeleton width="80%" height="0.875rem" />
                        <Skeleton width="50%" height="0.75rem" />
                      </div>
                    </div>
                  ) : colIdx === cols - 1 ? (
                    <div className="inline-flex gap-2 items-center justify-end">
                      <Skeleton width="60px" height="0.875rem" />
                      <Skeleton width="1.5rem" height="1.5rem" className="rounded" />
                    </div>
                  ) : (
                    <Skeleton width="45%" height="0.875rem" className="mx-auto" />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Pagination skeleton */}
      <div className="flex items-center justify-between pt-2">
        <Skeleton width="150px" height="0.875rem" />
        <div className="flex gap-1.5">
          <Skeleton width="2rem" height="2rem" className="rounded-lg" />
          <Skeleton width="2rem" height="2rem" className="rounded-lg" />
          <Skeleton width="2rem" height="2rem" className="rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// Composite Skeleton 3: Product / Portfolio Card Grid
export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full text-left" id="skeleton-grid">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-white border border-slate-200 rounded-3xl overflow-hidden p-5 space-y-4 shadow-sm"
          style={{ animationDelay: `${idx * 60}ms` }}
        >
          {/* Main Visual Box */}
          <Skeleton height="180px" className="rounded-2xl" />

          {/* Details */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Skeleton width="30%" height="0.75rem" />
              <Skeleton width="20%" height="0.75rem" />
            </div>
            <Skeleton width="90%" height="1.125rem" />
            <div className="space-y-1.5 pt-1">
              <Skeleton width="100%" height="0.75rem" />
              <Skeleton width="65%" height="0.75rem" />
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <Skeleton width="40%" height="1.25rem" />
            <Skeleton width="80px" height="2rem" className="rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Composite Skeleton 4: Detail Specs Page / Content View
export function SkeletonDetail() {
  return (
    <div className="space-y-6 w-full text-left" id="skeleton-detail">
      {/* Top Breadcrumb & Actions */}
      <div className="flex justify-between items-center">
        <Skeleton width="180px" height="0.875rem" />
        <Skeleton width="100px" height="2rem" className="rounded-xl" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left column: Heavy images or documents */}
        <div className="lg:col-span-5 space-y-4">
          <Skeleton height="350px" className="rounded-3xl" />
          <div className="grid grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((idx) => (
              <Skeleton key={idx} height="70px" className="rounded-xl" />
            ))}
          </div>
        </div>

        {/* Right column: Form details, specs */}
        <div className="lg:col-span-7 space-y-5">
          <div className="space-y-2">
            <Skeleton width="25%" height="0.75rem" />
            <Skeleton width="85%" height="2rem" />
            <Skeleton width="55%" height="1rem" />
          </div>

          <div className="border-t border-b border-slate-150 py-4.5 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Skeleton width="40%" height="0.75rem" />
                <Skeleton width="80%" height="1.125rem" />
              </div>
              <div className="space-y-1.5">
                <Skeleton width="30%" height="0.75rem" />
                <Skeleton width="70%" height="1.125rem" />
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <Skeleton width="100%" height="0.75rem" />
            <Skeleton width="100%" height="0.75rem" />
            <Skeleton width="85%" height="0.75rem" />
            <Skeleton width="40%" height="0.75rem" />
          </div>

          <div className="flex gap-3 pt-4">
            <Skeleton width="140px" height="2.5rem" className="rounded-xl" />
            <Skeleton width="100px" height="2.5rem" className="rounded-xl" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Composite Skeleton 5: Form Elements
export function SkeletonForm() {
  return (
    <div className="space-y-5 bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 w-full text-left" id="skeleton-form">
      <div className="space-y-2 pb-2 border-b border-slate-100">
        <Skeleton width="40%" height="1.5rem" />
        <Skeleton width="65%" height="0.875rem" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
        {[1, 2, 3, 4].map((idx) => (
          <div key={idx} className="space-y-1.5">
            <Skeleton width="35%" height="0.75rem" />
            <Skeleton height="2.5rem" className="rounded-xl" />
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <Skeleton width="20%" height="0.75rem" />
        <Skeleton height="6rem" className="rounded-xl" />
      </div>

      <div className="flex gap-3 pt-3 border-t border-slate-100 justify-end">
        <Skeleton width="90px" height="2.5rem" className="rounded-xl" />
        <Skeleton width="120px" height="2.5rem" className="rounded-xl" />
      </div>
    </div>
  );
}
