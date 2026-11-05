import { defineConfig } from 'vite';

// GitHub Pages 專案網址為 https://<user>.github.io/poke-oneclick/
export default defineConfig({
  base: process.env.VITE_BASE || '/poke-oneclick/',
  build: { target: 'es2018' },
});
