import { motion, HTMLMotionProps } from "framer-motion";
import { forwardRef, ReactNode } from "react";
import { cn } from "../lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

const sizeStyles: Record<Size, string> = {
  sm: "h-9 px-5 text-[13px]",
  md: "h-11 px-6 text-[14px]",
  lg: "h-13 px-8 text-[15px] md:h-14",
};

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-white text-black border border-white shadow-button hover:shadow-buttonHover",
  secondary:
    "bg-transparent text-white border border-white/20 hover:border-white/40 hover:bg-white/[0.05]",
  ghost: "bg-transparent text-white/70 border border-transparent hover:text-white",
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    children,
    iconLeft,
    iconRight,
    fullWidth,
    className,
    ...rest
  },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        // Pill shape
        "inline-flex items-center justify-center gap-2 rounded-pill font-sans font-medium",
        "transition-[background-color,color,border-color,box-shadow] duration-700 ease-out",
        "whitespace-nowrap select-none will-change-transform",
        sizeStyles[size],
        variantStyles[variant],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {iconLeft && <span className="flex items-center">{iconLeft}</span>}
      <span>{children}</span>
      {iconRight && <span className="flex items-center">{iconRight}</span>}
    </motion.button>
  );
});

export default Button;
