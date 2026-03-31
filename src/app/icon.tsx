import { ImageResponse } from 'next/og';

export const size = {
  width: 512,
  height: 512,
};

export const contentType = 'image/png';

export default function Icon() {
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
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 28,
            borderRadius: 88,
            border: '10px solid rgba(255,255,255,0.18)',
          }}
        />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 18,
          }}
        >
          <div
            style={{
              width: 176,
              height: 176,
              borderRadius: 44,
              background: 'rgba(255,255,255,0.16)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 92,
              fontWeight: 800,
              boxShadow: '0 24px 60px rgba(15, 23, 42, 0.22)',
            }}
          >
            R
          </div>
          <div style={{ fontSize: 54, fontWeight: 800, letterSpacing: 3 }}>RONDA</div>
        </div>
      </div>
    ),
    size
  );
}
