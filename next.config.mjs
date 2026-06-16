/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lint is run as a separate gate (`npm run lint`) so a style nit never blocks a build.
  eslint: { ignoreDuringBuilds: true },
  // Type errors DO block the build on purpose.
  typescript: { ignoreBuildErrors: false },
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
