import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { kioskSignedUrl } from "@/lib/kiosk.functions";

type Props = {
  tourUrl?: string | null;
  tourMediaPaths?: string[] | null;
};

function isVideoPath(p: string) {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(p);
}
function isImagePath(p: string) {
  return /\.(jpe?g|png|webp|gif|avif)(\?|$)/i.test(p);
}
function isEmbeddable(url: string) {
  return /matterport\.com|kuula\.co|youtu\.?be|youtube\.com|momento360|360cities/i.test(url);
}

export function TourViewer({ tourUrl, tourMediaPaths }: Props) {
  const signFn = useServerFn(kioskSignedUrl);
  const firstPath = tourMediaPaths?.[0] ?? null;

  const { data: signed, isLoading } = useQuery({
    queryKey: ["kiosk-tour-signed", firstPath],
    queryFn: async () => firstPath ? (await signFn({ data: { bucket: "apartment-tours", path: firstPath } })).url : null,
    enabled: !!firstPath,
  });

  if (firstPath) {
    if (isLoading) {
      return <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    }
    if (signed) {
      if (isVideoPath(firstPath)) {
        return <video src={signed} controls autoPlay className="h-full w-full bg-black object-contain" />;
      }
      if (isImagePath(firstPath)) {
        return <img src={signed} alt="360°" className="h-full w-full bg-black object-contain" />;
      }
      return <iframe src={signed} className="h-full w-full border-0" allow="fullscreen; xr-spatial-tracking" />;
    }
  }

  if (tourUrl) {
    if (isEmbeddable(tourUrl) || /^https?:\/\//.test(tourUrl)) {
      let src = tourUrl;
      // Convert youtube watch URL to embed
      const yt = tourUrl.match(/youtube\.com\/watch\?v=([^&]+)/);
      if (yt) src = `https://www.youtube.com/embed/${yt[1]}`;
      const short = tourUrl.match(/youtu\.be\/([^?]+)/);
      if (short) src = `https://www.youtube.com/embed/${short[1]}`;
      return <iframe src={src} className="h-full w-full border-0" allow="fullscreen; accelerometer; gyroscope; xr-spatial-tracking; autoplay" />;
    }
  }

  return (
    <div className="flex h-full items-center justify-center text-muted-foreground">
      3D-тур мавҷуд нест
    </div>
  );
}
