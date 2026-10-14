import Image from "next/image";

type SchoolLogoProps = {
  size?: number;
  className?: string;
};

export function SchoolLogo({ size = 48, className = "school-crest" }: SchoolLogoProps) {
  return (
    <Image
      src="/albayyan-international-school.png"
      alt="Albayyan International School crest"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}