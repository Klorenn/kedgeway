import styles from "./MenuButton.module.css";

interface MenuButtonProps {
  open: boolean;
  onClick: () => void;
  controls: string;
  openLabel: string;
  closeLabel: string;
}

/** Mobile nav toggle. Two bars drawn with CSS, no icon font. */
export default function MenuButton({ open, onClick, controls, openLabel, closeLabel }: MenuButtonProps) {
  return (
    <button type="button" className={styles.btn} aria-expanded={open} aria-controls={controls} aria-label={open ? closeLabel : openLabel} onClick={onClick}>
      <span className={styles.bars} aria-hidden="true" data-open={open} />
    </button>
  );
}
