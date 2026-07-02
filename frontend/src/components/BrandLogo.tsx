import rercLogo from "@/assets/rerc-logo.png";

type BrandLogoProps = {
  className?: string;
};

export function BrandLogo({ className = "" }: BrandLogoProps) {
  return (
    <img
      className={className}
      src={rercLogo}
      alt="RERC Research Ethics Review Committee logo"
      loading="eager"
      decoding="async"
    />
  );
}
