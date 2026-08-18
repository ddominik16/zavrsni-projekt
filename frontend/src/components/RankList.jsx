import { formatNumber } from "../format.js";

// Lista s trakom koja pokazuje udio u odnosu na najveci rezultat.
export default function RankList({ items, brick }) {
  if (!items.length) return null;
  const max = items[0].value || 1;

  return (
    <div>
      {items.map((item, i) => (
        <div className="rank__row" key={item.id || item.label}>
          <span className="rank__i">{String(i + 1).padStart(2, "0")}</span>
          <span className="rank__mid">
            <span className="rank__name">{item.label}</span>
            <span className="meter">
              <span
                className={brick ? "meter__f meter__f--brick" : "meter__f"}
                style={{ width: (item.value / max) * 100 + "%" }}
              />
            </span>
          </span>
          <span className="rank__val">{formatNumber(item.value)}</span>
        </div>
      ))}
    </div>
  );
}
