import { useEffect, useState } from "react";

// Mali hook da se u svakoj komponenti ne ponavlja isti loading/error kod.
// `deps` govori kada treba ponovno dohvatiti podatke.
export default function useFetch(fetcher, deps = [], enabled = true) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    // Ako se deps promijene prije nego prvi zahtjev zavrsi, stariji odgovor
    // ne smije pregaziti noviji.
    let ignore = false;
    setLoading(true);
    setError(null);

    fetcher()
      .then((result) => {
        if (!ignore) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!ignore) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // Kad se deps promijene, React prvo ponovno renderira pa tek onda pokrene
  // effect. U tom kratkom trenutku loading je jos false, a data je stara ili
  // null — zato loading racunamo i iz toga ima li uopce rezultata.
  const pending = enabled && data === null && error === null;

  return { data, error, loading: loading || pending };
}
