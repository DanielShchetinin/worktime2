export const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
export const MONTHS_GEN = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
export const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
export const WD_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
export const WD_FULL = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];

export const pad = (n) => String(n).padStart(2, "0");
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayISO = () => toISO(new Date());
export const nowHM = () => {
  const d = new Date();
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const parseISO = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const monthKey = (d = new Date()) => toISO(d).slice(0, 7);
export const shiftMonth = (key, delta) => {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
};
export const monthTitle = (key) => {
  const [y, m] = key.split("-").map(Number);
  return `${MONTHS[m - 1]} ${y}`;
};
export const dateLong = (s) => {
  const d = parseISO(s);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]}, ${WD_FULL[d.getDay()]}`;
};
export const dateShort = (s) => {
  const d = parseISO(s);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
};

export const money = (v, cur = "₪") => `${cur}${Math.round(v || 0).toLocaleString("ru-RU")}`;
export const money2 = (v, cur = "₪") =>
  `${cur}${(v || 0).toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const hrs = (h) => {
  const t = Math.round((h || 0) * 60);
  return `${Math.floor(t / 60)}ч ${pad(t % 60)}м`;
};
export const hrsShort = (h) => {
  const t = Math.round((h || 0) * 60);
  return `${Math.floor(t / 60)}:${pad(t % 60)}`;
};
export const hms = (sec) => {
  const s = Math.max(0, Math.floor(sec));
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
};

const RATE_COLORS = { 100: "#0A84FF", 120: "#64D2FF", 125: "#30D158", 150: "#FF9F0A", 175: "#FF6B6B", 200: "#BF5AF2" };
export const rateColor = (r) => RATE_COLORS[Math.round(Number(r))] || "#FF375F";
export const RATE_OPTIONS = [100, 120, 125, 130, 150, 175, 200];

export const KIND_LABELS = { work: "Рабочие часы", paid: "Оплачиваемое", unpaid: "Неоплачиваемое", off: "Выходной" };
export const HOLIDAY_KIND = { holiday: "Праздник", eve: "Канун", optional: "Памятный день", custom: "Особый день" };
