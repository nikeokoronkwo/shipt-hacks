import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    const pages = ["home", "find-shelter", "shelter-details", "track-ride", "become-a-driver", "driver-profile", "emergency-contacts", "shelter-registration", "submit-feedback"];
    return pages.map(page => ({ source: `/${page}.html`, destination: page === "home" ? "/" : `/${page}`, permanent: false }));
  },
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
