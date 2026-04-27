import { format, add, sub, startOfWeek, endOfWeek, startOfMonth, endOfMonth, parse, parseISO } from 'date-fns';
type DiffUnit = 'day' | 'week' | 'month' | 'months';
export class DateFnsHelper {
  public static getCurrentDate(outFormat = 'yyyy-MM-dd'): string {
    return format(new Date(), outFormat);
  }
  public static convertDate(date: string | Date, outFormat = 'yyyy-MM-dd'): string {
    const parsed = typeof date === 'string' ? parseISO(date) : date;
    return format(parsed, outFormat);
  }
  public static getDaysBeforeOrAfter(
    currentDay: string,
    amount = -1,
    unit: DiffUnit = 'day',
  ): string {
    const date = parse(currentDay, 'yyyy-MM-dd', new Date());
    let result: Date;
    if (unit === 'months' || unit === 'month') {
      result = amount > 0 ? sub(date, { months: 1 }) : add(date, { months: 1 });
    } else if (unit === 'week') {
      result = amount > 0 ? sub(date, { weeks: amount }) : add(date, { weeks: Math.abs(amount) });
    } else {
      result = amount > 0 ? sub(date, { days: amount }) : add(date, { days: Math.abs(amount) });
    }
    return format(result, 'yyyy-MM-dd');
  }
  public static calculateWeekRange(currentDate: string): { key: string } {
    const date = parse(currentDate, 'yyyy-MM-dd', new Date());
    const monday = startOfWeek(date, { weekStartsOn: 1 });
    const sunday = endOfWeek(date, { weekStartsOn: 1 });
    return { key: `${format(monday, 'yyyy-MM-dd')} - ${format(sunday, 'yyyy-MM-dd')}` };
  }
  public static calculateMonthRange(currentDate: string): { key: string } {
    const date = parse(currentDate, 'yyyy-MM-dd', new Date());
    const first = startOfMonth(date);
    const last = endOfMonth(date);
    return { key: `${format(first, 'yyyy-MM-dd')} - ${format(last, 'yyyy-MM-dd')}` };
  }
}
