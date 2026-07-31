import React from "react";

interface LogoProps {
  className?: string;
  size?: number;
}

export default function Logo({ className = "", size = 36 }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1000 1000"
      width={size}
      height={size}
      className={className}
    >
      {/* Circle background in exact dark green from the logo */}
      <circle cx="500" cy="500" r="415" fill="#006837" />
      
      {/* Head and Antennae white structure */}
      <path
        fill="#ffffff"
        d="M 500,360 
           C 490,360 485,350 485,310
           C 485,250 440,218 395,218
           C 345,218 318,260 318,310
           C 318,332 332,348 355,348
           C 375,348 395,335 410,315
           C 425,295 442,275 460,275
           C 475,275 480,295 480,352
           C 480,365 470,378 450,380
           C 410,385 354,435 354,530
           C 354,625 410,695 500,695
           C 590,695 646,625 646,530
           C 646,435 590,385 550,380
           C 530,378 520,365 520,352
           C 520,295 525,275 540,275
           C 558,275 575,295 590,315
           C 605,335 625,348 645,348
           C 668,348 682,332 682,310
           C 682,260 655,218 605,218
           C 560,218 515,250 515,310
           C 515,350 510,360 500,360
           Z"
      />
      
      {/* Left Eye Patch (Dark Green) */}
      <path
        fill="#006837"
        d="M 375,490
           C 370,440 425,410 450,450
           C 460,465 460,515 445,525
           C 430,535 378,530 375,490
           Z"
      />
      
      {/* Right Eye Patch (Dark Green) */}
      <path
        fill="#006837"
        d="M 625,490
           C 630,440 575,410 550,450
           C 540,465 540,515 555,525
           C 570,535 622,530 625,490
           Z"
      />
      
      {/* Eyeballs */}
      <circle cx="425" cy="475" r="32" fill="#ffffff" />
      <circle cx="575" cy="475" r="32" fill="#ffffff" />
      
      {/* Pupils (looking up and slightly right) */}
      <circle cx="435" cy="465" r="13" fill="#006837" />
      <circle cx="585" cy="465" r="13" fill="#006837" />
    </svg>
  );
}
