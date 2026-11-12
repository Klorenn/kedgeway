"use client";

import { useState } from "react";
import Gallop from "../Gallop";
import DesignFigure from "../ui/DesignFigure";
import PlateIndex from "./PlateIndex";
import styles from "./HeroPlate.module.css";

/** Gallop on Texture/Ground: the frame's hoof line (y = 91 of 101) sits on the ground's top edge. Then Plate/Index.
 *  The playing frame (1..11) is state here and drives the ruler. */
export default function HeroPlate() {
  const [frame, setFrame] = useState(8);
  return (
    <div className={`container ${styles.plate}`}>
      <div className={styles.stage}>
        <div className={styles.horse}>
          <Gallop startFrame={8} onFrame={setFrame} />
        </div>
        <DesignFigure name="textureGround" className={styles.ground} />
      </div>
      <PlateIndex frame={frame} />
    </div>
  );
}
