import { readFileSync } from 'node:fs';
import { GetStaticPropsContext } from 'next';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { parse } from 'yaml';
import path from 'node:path';
import { MyDefaultSeo } from '@/components/seo';
import { NextSeo } from 'next-seo';

export default function Home() {
  const t = useTranslations("");
  const title = t("page-title")

  return (
    <div>
      <MyDefaultSeo />
      <NextSeo title={title} openGraph={{ title }} />
      <h1>{t('greeting')}</h1>
      <p>{t('description')}</p>

      <div>
        <Link href="/" locale="en">English</Link> |
        <Link href="/" locale="ja">日本語</Link>
      </div>
    </div>
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