import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    }
  },
  webpack: (config) => {
    // alasql optionally targets a React Native filesystem backend that this
    // web-only app never uses. Stub those out so webpack doesn't try to
    // parse react-native's Flow syntax.
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      'react-native-fs': false,
      'react-native': false,
      'react-native-fetch-blob': false,
    }
    return config
  }
}

export default nextConfig
