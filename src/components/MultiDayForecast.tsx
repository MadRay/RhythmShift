import { CalendarDays, Sunrise, Sunset } from 'lucide-react';
import type { DayForecast } from '../types/sleep';

interface MultiDayForecastProps {
  forecasts: DayForecast[];
}

export function MultiDayForecast({ forecasts }: MultiDayForecastProps) {
  return (
    <section className="rounded-3xl border border-slate-700/60 bg-slate-900/80 p-5">
      <div className="flex items-center gap-2 mb-1">
        <CalendarDays className="h-4 w-4 text-indigo-300" />
        <h2 className="text-lg font-semibold text-slate-50">3-Day Rhythm Forecast</h2>
      </div>
      <p className="text-sm text-slate-400 mb-4">
        Circadian projection from age trends and tonight&apos;s bedtime anchor
      </p>

      <div className="space-y-3">
        {forecasts.map((day) => (
          <article
            key={day.dayLabel}
            className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-950/80 to-indigo-950/20 p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-slate-100">{day.dayLabel}</h3>
              <span className="text-xs text-slate-400">
                ~{Math.round(day.totalDaySleepMinutes / 60)}h {day.totalDaySleepMinutes % 60}m day sleep
              </span>
            </div>

            <div className="flex items-center gap-4 text-sm mb-3">
              <span className="inline-flex items-center gap-1.5 text-emerald-200/90">
                <Sunrise className="h-3.5 w-3.5" />
                {day.expectedWake}
              </span>
              <span className="inline-flex items-center gap-1.5 text-rose-200/90">
                <Sunset className="h-3.5 w-3.5" />
                {day.bedtime}
              </span>
            </div>

            <ul className="space-y-1.5">
              {day.naps.map((nap) => (
                <li
                  key={`${day.dayLabel}-${nap.title}`}
                  className="flex items-center justify-between text-xs rounded-xl bg-slate-900/70 border border-slate-700/40 px-3 py-2"
                >
                  <span className="text-slate-300">{nap.title}</span>
                  <span className="text-slate-400 tabular-nums">
                    {nap.startTime} · {nap.durationMinutes}m
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-3 text-xs text-slate-500 leading-relaxed">{day.notes}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
