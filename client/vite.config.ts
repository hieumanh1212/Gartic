import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' để chạy được ở bất kỳ đường dẫn nào trên GitHub Pages (vd: /ten-repo/)
export default defineConfig({
  base: './',
  plugins: [react()],
});
