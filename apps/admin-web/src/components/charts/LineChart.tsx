interface LineChartProps {
  data: { label: string; value: number }[];
  height?: number;
  color?: string;
  fillColor?: string;
  showLabels?: boolean;
  showValues?: boolean;
  unit?: string;
  formatValue?: (value: number) => string;
}

export function LineChart({
  data,
  height = 200,
  color = '#3B82F6',
  fillColor = 'rgba(59, 130, 246, 0.1)',
  showLabels = true,
  showValues = true,
  unit = '',
  formatValue = (v) => v.toLocaleString(),
}: LineChartProps) {
  if (data.length === 0) return null;

  const max = Math.max(...data.map(d => d.value), 1);
  const min = 0;
  const range = max - min;

  // Calculate points for SVG path
  const points = data.map((item, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((item.value - min) / range) * 100;
    return { x, y, value: item.value, label: item.label };
  });

  // Create SVG path
  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  // Create filled area path
  const areaPath = `${linePath} L 100 100 L 0 100 Z`;

  return (
    <div className="w-full">
      <div style={{ height: `${height}px` }} className="relative">
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map(y => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="100"
              y2={y}
              stroke="#E5E7EB"
              strokeWidth="0.5"
              vectorEffect="non-scaling-stroke"
            />
          ))}

          {/* Filled area */}
          <path
            d={areaPath}
            fill={fillColor}
          />

          {/* Line */}
          <path
            d={linePath}
            fill="none"
            stroke={color}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r="1.5"
              fill={color}
              className="hover:r-3 transition-all"
            >
              <title>{`${p.label}: ${formatValue(p.value)}${unit}`}</title>
            </circle>
          ))}
        </svg>

        {/* Value labels on hover points */}
        {showValues && (
          <div className="absolute inset-0 flex justify-between items-start pointer-events-none">
            {points.map((p, i) => (
              <div
                key={i}
                className="flex flex-col items-center"
                style={{
                  position: 'absolute',
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  transform: 'translate(-50%, -100%)',
                }}
              >
                <span className="text-xs text-gray-600 bg-white/80 px-1 rounded">
                  {formatValue(p.value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showLabels && (
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          {data.map((item, i) => (
            <div key={i} className="text-center">
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
