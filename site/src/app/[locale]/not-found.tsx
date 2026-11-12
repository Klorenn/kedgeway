import NotFoundBody from "@/components/NotFoundBody";

// not-found receives no params; NotFoundBody reads the locale from LocaleProvider (set by [locale]/layout).
export default function LocaleNotFound() {
  return <NotFoundBody />;
}
