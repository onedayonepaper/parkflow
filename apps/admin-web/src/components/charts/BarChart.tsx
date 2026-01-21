interface BarChartProps {
  data: { label: string; value: number; secondaryValue?: number }[];
  maxValue?: number;
  height?: number;
  primaryColor?: string;
  secondaryColor?: string;
  showLabels?: boolean;
  unit?: string;
}

export function BarChart({
  data,
  maxValue,
  height = 200,
  primaryColor = '#3B82F6',
  secondaryColor = '#10B981',
  showLabels = true,
  unit = '',
}: BarChartProps) {
  const max = maxValue || Math.max(...data.flatMap(d => [d.value, d.secondaryValue || 0]), 1);
  const barWidth = Math.max(100 / data.length - 2, 2);

  return (
    <div className="w-full">
      <div
        className="flex items-end justify-between gap-1"
        style={{ height: `${height}px` }}
      >
        {data.map((item, i) => {
          const primaryHeight = (item.value / max) * 100;
          const secondaryHeight = item.secondaryValue !== undefined
            ? (item.secondaryValue / max) * 100
            : 0;

          return (
            <div
              key={i}
              className="flex flex-col items-center flex-1 h-full justify-end"
              style={{ maxWidth: `${barWidth}%` }}
            >
              <div className="flex items-end gap-0.5 h-full w-full justify-center">
                {/* Primary bar */}
                <div
                  className="rounded-t transition-all duration-300 hover:opacity-80"
                  style={{
                    height: `${primaryHeight}%`,
                    backgroundColor: primaryColor,
                    width: item.secondaryValue !== undefined ? '45%' : '80%',
                    minHeight: item.value > 0 ? '4px' : '0',
                  }}
                  title={`${item.label}: ${item.value}${unit}`}
                />
                {/* Secondary bar */}
                {item.secondaryValue !== undefined && (
                  <div
                    className="rounded-t transition-all duration-300 hover:opacity-80"
                    style={{
                      height: `${secondaryHeight}%`,
                      backgroundColor: secondaryColor,
                      width: '45%',
                      minHeight: item.secondaryValue > 0 ? '4px' : '0',
                    }}
                    title={`${item.label}: ${item.secondaryValue}${unit}`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
      {showLabels && (
        <div className="flex justify-between mt-2 text-xs text-gray-500">
          {data.map((item, i) => (
            <div
              key={i}
              className="flex-1 text-center truncate"
              style={{ maxWidth: `${barWidth}%` }}
            >
              {item.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
