import { ImageResponse } from 'next/og';

export const size = {
  width: 180,
  height: 180,
};

export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0d6efd 0%, #0dcaf0 100%)',
          color: '#ffffff',
          fontFamily: 'Arial, sans-serif',
          borderRadius: 36,
        }}
      >
        <div
          style={{
            width: 92,
            height: 92,
            borderRadius: 24,
            background: 'rgba(255,255,255,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 54,
            fontWeight: 800,
          }}
        >
          R
        </div>
      </div>
    ),
    size
  );
}
