import { useEffect, useState } from 'react';
import { supabase } from '../../core/config/supabase';

export default function SelfieImage({ path, className, alt = 'Selfie', onClick }) {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function fetchUrl() {
      if (!path) {
        if (isMounted) {
          setUrl(null);
          setLoading(false);
        }
        return;
      }

      if (path.startsWith('http')) {
        if (isMounted) {
          setUrl(path);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      const { data, error } = await supabase.storage
        .from('selfies')
        .createSignedUrl(path, 3600);

      if (isMounted) {
        if (!error && data) {
          setUrl(data.signedUrl);
        } else {
          // Only log real errors now
          console.error('Failed to sign selfie URL:', error);
          setUrl(null);
        }
        setLoading(false);
      }
    }

    fetchUrl();
    return () => { isMounted = false; };
  }, [path]);

  if (loading) {
    return <div className={`animate-pulse bg-border/50 ${className}`} />;
  }

  if (!url) {
    return (
      <div className={`bg-bg flex items-center justify-center text-textLight ${className}`}>
        <span className="text-[10px]">—</span>
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      onClick={(e) => onClick?.(e, url)}
    />
  );
}