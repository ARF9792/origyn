"use client";

import {
  Canvas,
  useFrame,
  useThree,
} from "@react-three/fiber";

import * as THREE from "three";

import {
  useEffect,
  useMemo,
  useRef,
} from "react";


const COLS = 150;
const ROWS = 44;


const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  uniform vec2 uMouse;

  attribute float aRandom;
  attribute float aBand;

  varying float vAlpha;
  varying float vBrightness;


  void main() {
    vec3 p = position;

    float x = p.x;
    float row = p.y;


    /*
     * Main flowing wave.
     * Large, calm motion — not noisy plasma.
     */

    float phase =
      x * 0.52
      + uTime * 0.34
      + uScroll * 1.7;


    float centerWave =
        sin(phase) * 0.72
      + sin(
          x * 0.21
          - uTime * 0.19
          + uScroll * 0.7
        ) * 0.34;


    float breathing =
      1.0
      +
      sin(
        x * 0.28
        + uTime * 0.14
      ) * 0.11;


    p.y =
      centerWave
      +
      row * breathing;


    /*
     * Depth deformation.
     */

    p.z =
        sin(
          x * 0.38
          + row * 1.7
          + uTime * 0.22
        ) * 0.42

      + cos(
          x * 0.17
          - uTime * 0.11
        ) * 0.23;


    /*
     * Small cursor gravity field.
     */

    vec2 mouseWorld =
      vec2(
        uMouse.x * 6.8,
        uMouse.y * 3.4
      );


    float d =
      distance(
        vec2(
          p.x,
          p.y
        ),
        mouseWorld
      );


    float influence =
      exp(
        -d * d * 0.42
      );


    p.z +=
      influence * 0.42;


    p.y +=
      (
        p.y -
        mouseWorld.y
      )
      * influence
      * 0.035;


    /*
     * Subtle vertical drift with scroll.
     */

    p.y +=
      sin(
        uScroll * 3.14159
      ) * 0.12;


    vec4 mvPosition =
      modelViewMatrix *
      vec4(
        p,
        1.0
      );


    gl_Position =
      projectionMatrix *
      mvPosition;


    /*
     * Tiny points with depth variation.
     */

    float perspective =
      7.5 /
      max(
        1.0,
        -mvPosition.z
      );


    gl_PointSize =
      (
        1.15
        + aRandom * 1.45
      )
      * perspective;


    /*
     * Fade rows toward the outer edges
     * so the sheet dissolves naturally.
     */

    float edgeFade =
      smoothstep(
        0.0,
        0.42,
        aBand
      );


    vAlpha =
      edgeFade
      *
      (
        0.28
        + aRandom * 0.58
      );


    /*
     * Highlight the central ridge slightly.
     */

    float ridge =
      pow(
        aBand,
        1.6
      );


    vBrightness =
      0.55
      +
      ridge * 0.45;
  }
`;


const fragmentShader = /* glsl */ `
  precision highp float;

  varying float vAlpha;
  varying float vBrightness;


  void main() {

    /*
     * Circular particle.
     */

    vec2 centered =
      gl_PointCoord -
      vec2(0.5);


    float dist =
      length(centered);


    if (dist > 0.5) {
      discard;
    }


    /*
     * Crisp core + faint outer glow.
     */

    float core =
      1.0 -
      smoothstep(
        0.18,
        0.46,
        dist
      );


    float glow =
      1.0 -
      smoothstep(
        0.32,
        0.5,
        dist
      );


    float alpha =
      vAlpha
      *
      (
        core * 0.82
        +
        glow * 0.18
      );


    /*
     * Slight cool-white tint.
     */

    vec3 color =
      mix(
        vec3(
          0.52,
          0.56,
          0.64
        ),
        vec3(
          0.92,
          0.94,
          0.98
        ),
        vBrightness
      );


    gl_FragColor =
      vec4(
        color,
        alpha
      );
  }
`;


function MainWave() {
  const material =
    useRef<THREE.ShaderMaterial>(
      null
    );


  const targetMouse =
    useRef(
      new THREE.Vector2(
        0,
        0
      )
    );


  const currentMouse =
    useRef(
      new THREE.Vector2(
        0,
        0
      )
    );


  const targetScroll =
    useRef(0);


  const currentScroll =
    useRef(0);


  const { size } =
    useThree();


  const geometry =
    useMemo(() => {

      const count =
        COLS * ROWS;


      const positions =
        new Float32Array(
          count * 3
        );


      const randoms =
        new Float32Array(
          count
        );


      const bands =
        new Float32Array(
          count
        );


      let index =
        0;


      for (
        let xIndex = 0;
        xIndex < COLS;
        xIndex++
      ) {

        const u =
          xIndex /
          (
            COLS - 1
          );


        const x =
          (
            u -
            0.5
          )
          * 16.2;


        for (
          let rowIndex = 0;
          rowIndex < ROWS;
          rowIndex++
        ) {

          const v =
            rowIndex /
            (
              ROWS - 1
            );


          const row =
            (
              v -
              0.5
            )
            * 2.65;


          const random =
            Math.random();


          /*
           * Slight irregularity so it doesn't
           * look like a perfect spreadsheet.
           */

          const jitterX =
            (
              Math.random() -
              0.5
            )
            * 0.035;


          const jitterY =
            (
              Math.random() -
              0.5
            )
            * 0.035;


          positions[
            index * 3
          ] =
            x +
            jitterX;


          positions[
            index * 3 + 1
          ] =
            row +
            jitterY;


          positions[
            index * 3 + 2
          ] =
            0;


          randoms[index] =
            random;


          /*
           * 1 at central row,
           * 0 toward outer rows.
           */

          bands[index] =
            1.0 -
            Math.abs(
              v - 0.5
            ) *
            2.0;


          index++;
        }
      }


      const result =
        new THREE.BufferGeometry();


      result.setAttribute(
        "position",
        new THREE.BufferAttribute(
          positions,
          3
        )
      );


      result.setAttribute(
        "aRandom",
        new THREE.BufferAttribute(
          randoms,
          1
        )
      );


      result.setAttribute(
        "aBand",
        new THREE.BufferAttribute(
          bands,
          1
        )
      );


      return result;

    }, []);


  const uniforms =
    useMemo(
      () => ({
        uTime: {
          value: 0,
        },

        uScroll: {
          value: 0,
        },

        uMouse: {
          value:
            new THREE.Vector2(
              0,
              0
            ),
        },
      }),
      []
    );


  useEffect(() => {

    const handlePointerMove =
      (
        event: PointerEvent
      ) => {

        targetMouse.current.set(
          (
            event.clientX /
            window.innerWidth
          ) * 2 - 1,

          -(
            (
              event.clientY /
              window.innerHeight
            ) * 2 - 1
          )
        );
      };


    const handleScroll =
      () => {

        const maxScroll =
          Math.max(
            1,
            document.documentElement
              .scrollHeight -
            window.innerHeight
          );


        targetScroll.current =
          window.scrollY /
          maxScroll;
      };


    window.addEventListener(
      "pointermove",
      handlePointerMove,
      {
        passive: true,
      }
    );


    window.addEventListener(
      "scroll",
      handleScroll,
      {
        passive: true,
      }
    );


    handleScroll();


    return () => {

      window.removeEventListener(
        "pointermove",
        handlePointerMove
      );


      window.removeEventListener(
        "scroll",
        handleScroll
      );
    };

  }, []);


  useFrame(
    ({
      clock,
    }) => {

      if (!material.current) {
        return;
      }


      currentMouse.current.lerp(
        targetMouse.current,
        0.035
      );


      currentScroll.current +=
        (
          targetScroll.current -
          currentScroll.current
        ) *
        0.04;


      uniforms.uTime.value =
        clock.elapsedTime;


      uniforms.uMouse.value.copy(
        currentMouse.current
      );


      uniforms.uScroll.value =
        currentScroll.current;
    }
  );


  /*
   * Wider screens get slightly larger
   * field coverage.
   */

  const waveScale =
    size.width > 1400
      ? 1.12
      : 1;


  return (
    <points
      geometry={geometry}
      scale={[
        waveScale,
        waveScale,
        waveScale,
      ]}
      frustumCulled={false}
    >
      <shaderMaterial
        ref={material}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        depthTest
        blending={
          THREE.AdditiveBlending
        }
      />
    </points>
  );
}


function AmbientDust() {
  const points =
    useRef<THREE.Points>(
      null
    );


  const geometry =
    useMemo(() => {

      const count =
        700;


      const positions =
        new Float32Array(
          count * 3
        );


      for (
        let i = 0;
        i < count;
        i++
      ) {

        positions[
          i * 3
        ] =
          (
            Math.random() -
            0.5
          ) *
          18;


        positions[
          i * 3 + 1
        ] =
          (
            Math.random() -
            0.5
          ) *
          10;


        positions[
          i * 3 + 2
        ] =
          -2
          -
          Math.random() * 4;
      }


      const result =
        new THREE.BufferGeometry();


      result.setAttribute(
        "position",
        new THREE.BufferAttribute(
          positions,
          3
        )
      );


      return result;

    }, []);


  useFrame(
    (
      _,
      delta
    ) => {

      if (!points.current) {
        return;
      }


      points.current.rotation.z +=
        delta * 0.0025;


      points.current.rotation.y +=
        delta * 0.0015;
    }
  );


  return (
    <points
      ref={points}
      geometry={geometry}
    >
      <pointsMaterial
        size={0.018}
        color="#88909e"
        transparent
        opacity={0.18}
        depthWrite={false}
      />
    </points>
  );
}


export default function ParticleWave() {
  return (
    <div
      className="origyn-particle-bg"
      aria-hidden="true"
    >
      <Canvas
        dpr={[
          1,
          1.5,
        ]}
        camera={{
          position: [
            0,
            0,
            8.2,
          ],
          fov: 48,
          near: 0.1,
          far: 50,
        }}
        gl={{
          alpha: true,
          antialias: false,
          powerPreference:
            "high-performance",
        }}
      >
        <AmbientDust />

        <MainWave />
      </Canvas>
    </div>
  );
}