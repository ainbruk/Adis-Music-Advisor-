/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "i.scdn.co" },
      { protocol: "https", hostname: "mosaic.scdn.co" },
      { protocol: "https", hostname: "*.scdn.co" },
      { protocol: "https", hostname: "*.spotifycdn.com" },
      { protocol: "https", hostname: "i1.sndcdn.com" },
      { protocol: "https", hostname: "i2.sndcdn.com" },
      { protocol: "https", hostname: "i3.sndcdn.com" },
      { protocol: "https", hostname: "i4.sndcdn.com" },
      { protocol: "https", hostname: "*.sndcdn.com" },
      { protocol: "https", hostname: "lastfm.freetls.fastly.net" },
      { protocol: "https", hostname: "*.discogs.com" },
    ],
  },
};

export default nextConfig;
