import { QRCodeSVG } from 'qrcode.react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function QrCard({ code }) {
  return (
    <Link
      to="/qr"
      className="bg-white rounded-2xl p-5 shadow-sm border border-border flex items-center gap-4 hover:border-primary transition group"
    >
      <div className="bg-white p-3 rounded-2xl border border-border shrink-0">
        {code ? (
          <QRCodeSVG value={code} size={90} level="M" />
        ) : (
          <div className="w-[90px] h-[90px] bg-bg rounded-lg" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold tracking-wider text-textLight mb-1">
          TODAY'S CHECK-IN QR
        </p>
        <p className="text-sm font-mono text-textDark truncate mb-2">
          {code ?? 'No code'}
        </p>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary group-hover:gap-2 transition-all">
          View full <ArrowRight size={12} />
        </span>
      </div>
    </Link>
  );
}
