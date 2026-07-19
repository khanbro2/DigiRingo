import { useState, type CSSProperties } from "react";

/**
 * iPhone-style mockup that frames a real DIGIRINGO app screenshot. Drop captures
 * into /public/shots (e.g. shots/home.png); until they exist a styled caption
 * placeholder keeps the layout intact. `glow` paints the brand halo behind it.
 */
export function PhoneFrame({
  src,
  caption,
  glow = true,
  style,
}: {
  src?: string;
  caption?: string;
  glow?: boolean;
  style?: CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  const showImg = src && !failed;

  return (
    <div className="dg-phone" style={style}>
      {glow && <div className="dg-phone-glow" />}
      <div className="dg-phone-screen">
        {showImg ? (
          <img src={src} alt={caption ?? "DIGIRINGO app screen"} onError={() => setFailed(true)} loading="lazy" />
        ) : (
          <div className="dg-shot-fallback">
            <span style={{ fontSize: 26 }}>📱</span>
            <span>{caption ?? "App preview"}</span>
          </div>
        )}
      </div>
    </div>
  );
}
