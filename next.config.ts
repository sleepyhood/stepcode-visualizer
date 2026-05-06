/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // 정적 호스팅을 위한 필수 설정
  images: {
    unoptimized: true, // next/image 사용 시 정적 호스팅에서 필요 (이미지 최적화 서버가 없으므로)
  },
  // 만약 레포지토리 주소가 https://username.github.io/stepcode-visualizer/ 라면 아래 주석을 해제하세요.
  // basePath: '/stepcode-visualizer', 
};

export default nextConfig;
// import type { NextConfig } from "next";

// const nextConfig: NextConfig = {
//   /* config options here */
// };

// export default nextConfig;
