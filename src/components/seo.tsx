import { useTranslations } from "next-intl";
import { DefaultSeo, DefaultSeoProps } from "next-seo";
import { useRouter } from "next/router";
import { JSX } from "react";

const supportedLocales = (process.env.NEXT_PUBLIC_SUPPORTED_LOCALES_SEPARATE_BY_COMMA ?? 'en').split(',');
const defaultLocale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? 'en';
const defaultOrigin = process.env.NEXT_PUBLIC_FRONTEND_ORIGIN ?? 'http://localhost:3000';
const ogImageWidth = 1200;
const ogImageHeight = 630;

function buildLocalizedUrlFromLocale(path: string, locale: string): string {
    return `${defaultOrigin}${locale === defaultLocale ? '' : `/${locale}`}${path === '/' ? '' : path}`;
}

type LanguageAlternate = Exclude<DefaultSeoProps['languageAlternates'], undefined>[number];

function buildLanguageAlternate(bathPath: string, hrefLang: string): LanguageAlternate {
    return {
        hrefLang,
        href: buildLocalizedUrlFromLocale(bathPath, hrefLang),
    };
}

function buildLanguageAlternates(bathPath: string, hrefLangs: string[]): LanguageAlternate[] {
    const xDefault: LanguageAlternate = {
        hrefLang: 'x-default',
        href: buildLocalizedUrlFromLocale(bathPath, defaultLocale),
    };
    return [...hrefLangs.map((hrefLang) => buildLanguageAlternate(bathPath, hrefLang)), xDefault];
}

export const MyDefaultSeo = (): JSX.Element => {
    const t = useTranslations("");
    // クエリを含める場合はasPathなどを使用する
    const { locale, pathname } = useRouter();
    const siteName = t('$site-name');
    const titleTemplate = `${siteName} | %s`;
    const description = t('$site-description');
    const ogImageUrl = `${defaultOrigin}${t('$og-image-path')}`;
    // 正規化したパス
    const canonical = buildLocalizedUrlFromLocale(pathname, locale!);
    // 言語毎に正規化したパスを算出する
    const languageAlternates = buildLanguageAlternates(pathname, supportedLocales);
    return (
        <DefaultSeo
            defaultTitle={siteName}
            titleTemplate={titleTemplate}
            description={description}
            canonical={canonical}
            languageAlternates={languageAlternates}
            openGraph={{
                title: siteName,
                description,
                images: [{ url: ogImageUrl, height: ogImageHeight, width: ogImageWidth, alt: siteName }],
                type: 'website',
                site_name: siteName,
                locale,
                url: canonical,
            }}
        />
    );
};
