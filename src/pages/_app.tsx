import { NextIntlClientProvider } from "next-intl";
import { AppProps } from "next/app";
import { useRouter } from "next/router";
import '@/styles/index.css'
import '@/styles/fonts.css'

export default function App({ Component, pageProps }: AppProps) {
    const router = useRouter()

    return (
        <NextIntlClientProvider
            locale={router.locale}
            timeZone="Asia/Tokyo"
            messages={pageProps.messages}
        >
            <Component {...pageProps} />
        </NextIntlClientProvider>
    )
}
