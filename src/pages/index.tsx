import { readFileSync } from 'node:fs';
import { GetStaticPropsContext } from 'next';
import { useTranslations } from 'next-intl';
import { parse } from 'yaml';
import path from 'node:path';
import React from 'react';
import App from './App.tsx'
import '@/styles/index.css'
import "react-color-palette/css";
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline, createTheme } from '@mui/material';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});


export default function Home() {
  const t = useTranslations("");

  return (
    <React.StrictMode>
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <App />
      </ThemeProvider>
    </React.StrictMode>
  );
}

export async function getStaticProps(context: GetStaticPropsContext) {
  const locale = context.locale || 'en';  // デフォルトで 'en' を使用

  try {
    // YAML ファイルを読み込む
    const filePath = path.resolve('src/locales', `${locale}.yml`);
    const fileContents = readFileSync(filePath, 'utf8');
    const messages = parse(fileContents);  // YAML をパース

    return {
      props: {
        messages,
      },
    };
  } catch (error) {
    console.error(`Error loading translation for ${locale}:`, error);
    return {
      props: {
        messages: {},  // エラーハンドリング：翻訳ファイルが読み込めなかった場合
      },
    };
  }
}