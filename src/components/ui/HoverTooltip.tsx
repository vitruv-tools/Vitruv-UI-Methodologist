import React, { useId, useState } from 'react';

const APP_FONT = 'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif';

export interface HoverTooltipProps {
  label: string;
  description?: string;
  placement?: 'right' | 'bottom';
  style?: React.CSSProperties;
  children: React.ReactElement;
}

function tooltipPositionStyle(placement: 'right' | 'bottom'): React.CSSProperties {
  if (placement === 'bottom') {
    return {
      top: 'calc(100% + 8px)',
      left: '50%',
      transform: 'translateX(-50%)',
    };
  }
  return {
    left: 'calc(100% + 10px)',
    top: '50%',
    transform: 'translateY(-50%)',
  };
}

type HoverHandlerProps = {
  onMouseEnter?: React.MouseEventHandler;
  onMouseLeave?: React.MouseEventHandler;
  'aria-describedby'?: string;
};

export const HoverTooltip: React.FC<HoverTooltipProps> = ({
  label,
  description,
  placement = 'right',
  style,
  children,
}) => {
  const [visible, setVisible] = useState(false);
  const tooltipId = useId();

  const child = React.Children.only(children);
  const trigger = React.isValidElement<HoverHandlerProps>(child)
    ? React.cloneElement(child, {
        onMouseEnter: (event: React.MouseEvent) => {
          child.props.onMouseEnter?.(event);
          setVisible(true);
        },
        onMouseLeave: (event: React.MouseEvent) => {
          child.props.onMouseLeave?.(event);
          setVisible(false);
        },
        'aria-describedby': visible ? tooltipId : child.props['aria-describedby'],
      })
    : children;

  return (
    <span style={{ position: 'relative', display: 'inline-flex', ...style }}>
      {trigger}
      {visible && (
        <div
          id={tooltipId}
          role="tooltip"
          style={{
            position: 'absolute',
            ...tooltipPositionStyle(placement),
            zIndex: 2000,
            pointerEvents: 'none',
            maxWidth: 240,
            padding: description ? '8px 10px' : '6px 10px',
            borderRadius: 8,
            background: '#0f172a',
            color: '#ffffff',
            fontFamily: APP_FONT,
            fontSize: 12,
            fontWeight: 600,
            lineHeight: 1.35,
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.28)',
            whiteSpace: 'normal',
          }}
        >
          {label}
          {description && (
            <div style={{ marginTop: 3, fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.82)' }}>
              {description}
            </div>
          )}
        </div>
      )}
    </span>
  );
};
