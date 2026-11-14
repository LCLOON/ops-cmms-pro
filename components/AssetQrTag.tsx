'use client';

import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import QRCode from 'qrcode';

export default function AssetQrTag({ asset }: { asset: { id: string; name: string } }) {
  const [open, setOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    let active = true;
    const url = new URL('/app', window.location.origin);
    url.searchParams.set('assetId', asset.id);
    QRCode.toDataURL(url.toString(), { width: 320, margin: 2, errorCorrectionLevel: 'M' })
      .then(dataUrl => { if (active) { setImageUrl(dataUrl); setError(''); } })
      .catch(generationError => {
        console.error('[assets] Failed to generate asset QR tag', generationError);
        if (active) setError('Could not generate the QR tag. Please try again.');
      });
    return () => { active = false; };
  }, [asset.id, open]);

  return (
    <div>
      <button onClick={() => setOpen(value => !value)}
        className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 text-slate-100 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors">
        {open ? 'Hide QR tag' : 'QR tag'}
      </button>
      {open && (
        <div className="asset-qr-print mt-4 flex flex-wrap items-center gap-4 rounded-lg border border-slate-700 bg-white p-4 text-slate-900">
          {imageUrl
            ? <Image src={imageUrl} alt={`QR code for ${asset.name}`} width={320} height={320} unoptimized className="h-40 w-40" />
            : !error && <span className="text-sm text-slate-500">Generating QR tag...</span>}
          <div className="min-w-[220px]">
            <h4 className="font-bold">{asset.name}</h4>
            <p className="mt-1 font-mono text-xs">{asset.id}</p>
            <p className="mt-2 text-xs">Scan to open this asset in OpsCMMSPro, then start an inspection, testing record, or oil sample.</p>
            <p className="mt-1 text-[11px] text-slate-500">Your normal sign-in is still required. The QR contains no access token.</p>
            {error && <p role="alert" className="mt-2 text-xs text-red-700">{error}</p>}
            <div className="asset-qr-print-controls mt-3 flex flex-wrap gap-2">
              <button onClick={() => window.print()} disabled={!imageUrl}
                className="rounded bg-blue-700 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50">Print label</button>
              {imageUrl && <a href={imageUrl} download={`${asset.id}-qr.png`}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium">Download PNG</a>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
