import { createMDX } from 'fumadocs-mdx/next';
import { setupDevPlatform } from '@cloudflare/next-on-pages/next-dev';


const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  reactStrictMode: true,
  images: {
    remotePatterns: 
    [
      new URL('https://raw.githubusercontent.com/**/**'), 
      new URL('https://github.com/**/**')
    ],
  },
};

if (process.env.NODE_ENV === 'development') {
  await setupDevPlatform();
}

export default withMDX(config);
