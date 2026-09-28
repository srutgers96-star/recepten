// Pill-style segmented control. `multi` renders checkboxes (several may be on), otherwise radios.
export interface SegOption<V extends string> {
  value: V;
  label: string;
  /** Extra class when selected, e.g. 'pass' | 'fail'. */
  tone?: string;
}

export function Segmented<V extends string>(props: {
  name: string;
  options: SegOption<V>[];
  selected: V[];
  multi?: boolean;
  onChange: (next: V[]) => void;
}) {
  return (
    <div class="seg" role="group">
      {props.options.map((o) => {
        const on = props.selected.includes(o.value);
        return (
          <label key={o.value} class={(on ? 'on ' : '') + (o.tone ?? '')}>
            <input
              type={props.multi ? 'checkbox' : 'radio'}
              name={props.name}
              checked={on}
              onClick={() => {
                if (props.multi) {
                  props.onChange(on ? props.selected.filter((v) => v !== o.value) : [...props.selected, o.value]);
                } else {
                  props.onChange(on ? [] : [o.value]);
                }
              }}
            />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}
