/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.alicdn.com" },
      { protocol: "https", hostname: "**.taobao.com" },
      { protocol: "https", hostname: "**.1688.com" }
    ]
  }
};

export default nextConfig;
