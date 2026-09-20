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


const COLS = 170;
const ROWS = 48;


/* =========================================================
   SHADERS
   ========================================================= */

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  uniform float uStage;
  uniform vec2 uMouse;

  attribute float aRandom;
  attribute float aBand;

  varying float vAlpha;
  varying float vBrightness;
  varying float vAmber;


  float sceneWeight(
    float stage,
    float target
  ) {
    return clamp(
      1.0 -
      abs(stage - target),
      0.0,
      1.0
    );
  }


  void main() {

    vec3 p = position;

    float x = p.x;
    float row = p.y;

    float t =
      uTime;


    /* =====================================================
       STAGE WEIGHTS
       ===================================================== */

    float w0 =
      sceneWeight(
        uStage,
        0.0
      );

    float w1 =
      sceneWeight(
        uStage,
        1.0
      );

    float w2 =
      sceneWeight(
        uStage,
        2.0
      );

    float w3 =
      sceneWeight(
        uStage,
        3.0
      );

    float w4 =
      sceneWeight(
        uStage,
        4.0
      );

    float w5 =
      sceneWeight(
        uStage,
        5.0
      );


    float totalWeight =
      max(
        0.001,
        w0 +
        w1 +
        w2 +
        w3 +
        w4 +
        w5
      );


    /* =====================================================
       0 — HERO
       Calm, broad sheet
       ===================================================== */

    float heroCenter =
        sin(
          x * 0.52 +
          t * 0.32
        ) * 0.72

      + sin(
          x * 0.21 -
          t * 0.18
        ) * 0.33;


    float heroY =
      heroCenter
      +
      row
      *
      (
        1.0 +
        sin(
          x * 0.27 +
          t * 0.13
        ) * 0.10
      );


    float heroZ =
        sin(
          x * 0.38 +
          row * 1.65 +
          t * 0.21
        ) * 0.42

      + cos(
          x * 0.17 -
          t * 0.11
        ) * 0.22;


    /* =====================================================
       1 — SOURCES / INTAKE
       Wave opens around central product UI
       ===================================================== */

    float sourceCenter =
        sin(
          x * 0.44 +
          t * 0.27
        ) * 0.56

      + sin(
          x * 0.16 -
          t * 0.14
        ) * 0.22;


    /*
     * Opening in the middle of the scene.
     */

    float opening =
      exp(
        -x * x * 0.055
      );


    float side =
      row >= 0.0
        ? 1.0
        : -1.0;


    float sourceY =
      sourceCenter
      +
      row * 0.92
      +
      side
      * opening
      * 0.62;


    float sourceZ =
        sin(
          x * 0.31 +
          row * 1.3 +
          t * 0.18
        ) * 0.34

      + opening * 0.22;


    /* =====================================================
       2 — CLAIMS
       Sheet divides into separate evidence streams
       ===================================================== */

    float normalizedRow =
      (
        row + 1.325
      )
      /
      2.65;


    float group =
      floor(
        normalizedRow * 6.0
      );


    group =
      clamp(
        group,
        0.0,
        5.0
      );


    float groupCenter =
      (
        group -
        2.5
      )
      * 0.43;


    float claimsY =
        groupCenter

      + sin(
          x * 0.47
          + group * 0.92
          + t * 0.29
        ) * 0.19

      + sin(
          x * 0.18
          - t * 0.13
        ) * 0.09;


    float claimsZ =
        sin(
          x * 0.34
          + group * 1.3
          + t * 0.23
        ) * 0.45

      +
        (
          group -
          2.5
        )
        * 0.055;


    /* =====================================================
       3 — CHAT
       Evidence streams converge toward one answer
       ===================================================== */

    float convergence =
      smoothstep(
        -5.6,
        5.0,
        x
      );


    float chatSpread =
      mix(
        row,
        row * 0.11,
        convergence
      );


    float chatCenter =
        sin(
          x * 0.42 +
          t * 0.26
        ) * 0.33

      + sin(
          x * 0.16 -
          t * 0.12
        ) * 0.14;


    float chatY =
      chatCenter
      +
      chatSpread;


    float chatZ =
      sin(
        x * 0.30
        + row * 1.9
        + t * 0.19
      )
      *
      mix(
        0.44,
        0.16,
        convergence
      );


    /* =====================================================
       4 — GRAPH / EVIDENCE CHANGE
       More structured evidence paths
       ===================================================== */

    float graphGroup =
      floor(
        normalizedRow * 8.0
      );


    graphGroup =
      clamp(
        graphGroup,
        0.0,
        7.0
      );


    float graphCenter =
      (
        graphGroup -
        3.5
      )
      * 0.31;


    float direction =
      mod(
        graphGroup,
        2.0
      ) < 1.0
        ? 1.0
        : -1.0;


    float graphY =
        graphCenter

      + direction
        * x
        * 0.045

      + sin(
          x * 0.74
          + graphGroup * 0.7
          + t * 0.18
        ) * 0.08;


    float graphZ =
        sin(
          x * 0.55
          + graphGroup
          + t * 0.14
        ) * 0.24;


    /*
     * Moving amber evidence-change disturbance.
     */

    float pulseX =
      mod(
        t * 1.35,
        20.0
      )
      - 10.0;


    float pulseDistance =
      abs(
        x -
        pulseX
      );


    float evidencePulse =
      exp(
        -pulseDistance
        * pulseDistance
        * 0.75
      );


    /* =====================================================
       5 — FINAL CTA
       Everything becomes calm and gathers inward
       ===================================================== */

    float finalShrink =
      0.72;


    float finalX =
      x *
      finalShrink;


    float finalY =
        row * 0.30

      + sin(
          finalX * 0.60
          + t * 0.16
        ) * 0.23

      + sin(
          finalX * 0.20
          - t * 0.08
        ) * 0.09;


    float finalZ =
        sin(
          finalX * 0.28
          + row * 1.3
          + t * 0.11
        ) * 0.22;


    /* =====================================================
       MORPH BETWEEN STAGES
       ===================================================== */

    p.x =
      (
        x * (
          w0 +
          w1 +
          w2 +
          w3 +
          w4
        )
        +
        finalX * w5
      )
      /
      totalWeight;


    p.y =
      (
          heroY * w0
        + sourceY * w1
        + claimsY * w2
        + chatY * w3
        + graphY * w4
        + finalY * w5
      )
      /
      totalWeight;


    p.z =
      (
          heroZ * w0
        + sourceZ * w1
        + claimsZ * w2
        + chatZ * w3
        + graphZ * w4
        + finalZ * w5
      )
      /
      totalWeight;


    /* =====================================================
       MOUSE DEFORMATION
       ===================================================== */

    vec2 mouseWorld =
      vec2(
        uMouse.x * 6.8,
        uMouse.y * 3.4
      );


    float mouseDistance =
      distance(
        vec2(
          p.x,
          p.y
        ),
        mouseWorld
      );


    float mouseInfluence =
      exp(
        -mouseDistance
        * mouseDistance
        * 0.42
      );


    p.z +=
      mouseInfluence
      * 0.38;


    p.y +=
      (
        p.y -
        mouseWorld.y
      )
      *
      mouseInfluence
      *
      0.025;


    /* =====================================================
       CAMERA / POINT SIZE
       ===================================================== */

    vec4 mvPosition =
      modelViewMatrix
      *
      vec4(
        p,
        1.0
      );


    gl_Position =
      projectionMatrix
      *
      mvPosition;


    float perspective =
      7.4
      /
      max(
        1.0,
        -mvPosition.z
      );


    gl_PointSize =
      (
        1.05
        +
        aRandom * 1.55
      )
      *
      perspective;


    /* =====================================================
       PARTICLE VISIBILITY
       ===================================================== */

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
        +
        aRandom * 0.62
      );


    /*
     * Claims and graph become slightly more defined.
     */

    vAlpha *=
      1.0
      +
      w2 * 0.08
      +
      w4 * 0.14;


    float ridge =
      pow(
        aBand,
        1.6
      );


    vBrightness =
      0.52
      +
      ridge * 0.48;


    /*
     * Only graph stage gets warm semantic disturbance.
     */

    vAmber =
      evidencePulse
      *
      w4;
  }
`;


const fragmentShader = /* glsl */ `
  precision highp float;

  varying float vAlpha;
  varying float vBrightness;
  varying float vAmber;


  void main() {

    vec2 point =
      gl_PointCoord -
      vec2(0.5);


    float distanceFromCenter =
      length(point);


    if (
      distanceFromCenter >
      0.5
    ) {
      discard;
    }


    float core =
      1.0
      -
      smoothstep(
        0.16,
        0.43,
        distanceFromCenter
      );


    float glow =
      1.0
      -
      smoothstep(
        0.30,
        0.50,
        distanceFromCenter
      );


    float alpha =
      vAlpha
      *
      (
        core * 0.84
        +
        glow * 0.16
      );


    vec3 cool =
      mix(
        vec3(
          0.48,
          0.52,
          0.61
        ),
        vec3(
          0.93,
          0.95,
          0.99
        ),
        vBrightness
      );


    /*
     * Evidence-change color.
     *
     * Amber is deliberately sparse.
     */

    vec3 amber =
      vec3(
        0.92,
        0.63,
        0.25
      );


    vec3 color =
      mix(
        cool,
        amber,
        clamp(
          vAmber * 0.82,
          0.0,
          1.0
        )
      );


    gl_FragColor =
      vec4(
        color,
        alpha
      );
  }
`;


/* =========================================================
   MAIN PARTICLE WAVE
   ========================================================= */

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


  const targetStage =
    useRef(0);


  const currentStage =
    useRef(0);


  const { size } =
    useThree();


  /* =======================================================
     GEOMETRY
     ======================================================= */

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
            Math.random();


          bands[index] =
            1.0
            -
            Math.abs(
              v - 0.5
            )
            * 2.0;


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

        uStage: {
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


  /* =======================================================
     SCROLL → CINEMATIC STAGE
     ======================================================= */

  useEffect(() => {

    const stageAnchors = [
      {
        selector: ".hero",
        stage: 0,
      },

      {
        selector: "#intake",
        stage: 1,
      },

      {
        selector: "#planning",
        stage: 2,
      },

      {
        selector: "#automation",
        stage: 3,
      },

      {
        selector: "#build",
        stage: 4,
      },

      {
        selector: "#closing",
        stage: 5,
      },
    ];


    const calculateStage =
      () => {

        const viewportPoint =
          window.scrollY
          +
          window.innerHeight
          * 0.52;


        const anchors =
          stageAnchors
            .map(
              ({
                selector,
                stage,
              }) => {

                const element =
                  document.querySelector(
                    selector
                  );


                if (!element) {
                  return null;
                }


                const rect =
                  element
                    .getBoundingClientRect();


                return {
                  stage,

                  position:
                    rect.top
                    +
                    window.scrollY
                    +
                    rect.height
                    * 0.5,
                };

              }
            )
            .filter(
              (
                value
              ): value is {
                stage: number;
                position: number;
              } =>
                value !== null
            );


        if (
          anchors.length <
          2
        ) {
          targetStage.current =
            0;

          return;
        }


        if (
          viewportPoint <=
          anchors[0].position
        ) {

          targetStage.current =
            anchors[0].stage;

          return;
        }


        const last =
          anchors[
            anchors.length - 1
          ];


        if (
          viewportPoint >=
          last.position
        ) {

          targetStage.current =
            last.stage;

          return;
        }


        for (
          let i = 0;
          i <
          anchors.length - 1;
          i++
        ) {

          const current =
            anchors[i];


          const next =
            anchors[i + 1];


          if (
            viewportPoint >=
              current.position
            &&
            viewportPoint <=
              next.position
          ) {

            const progress =
              (
                viewportPoint -
                current.position
              )
              /
              (
                next.position -
                current.position
              );


            /*
             * Smooth interpolation instead of
             * linear hard-feeling transition.
             */

            const smoothProgress =
              progress
              * progress
              *
              (
                3.0 -
                2.0 * progress
              );


            targetStage.current =
              THREE.MathUtils.lerp(
                current.stage,
                next.stage,
                smoothProgress
              );


            return;
          }
        }
      };


    const handlePointerMove =
      (
        event: PointerEvent
      ) => {

        targetMouse.current.set(

          (
            event.clientX /
            window.innerWidth
          )
          * 2
          - 1,


          -(
            (
              event.clientY /
              window.innerHeight
            )
            * 2
            - 1
          )
        );
      };


    const handleScroll =
      () => {

        const maxScroll =
          Math.max(
            1,

            document.documentElement
              .scrollHeight
            -
            window.innerHeight
          );


        targetScroll.current =
          window.scrollY /
          maxScroll;


        calculateStage();
      };


    const handleResize =
      () => {

        calculateStage();
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


    window.addEventListener(
      "resize",
      handleResize
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


      window.removeEventListener(
        "resize",
        handleResize
      );
    };

  }, []);


  /* =======================================================
     RENDER LOOP
     ======================================================= */

  useFrame(
    ({
      clock,
    }) => {

      if (!material.current) {
        return;
      }


      currentMouse.current.lerp(
        targetMouse.current,
        0.04
      );


      currentScroll.current +=
        (
          targetScroll.current -
          currentScroll.current
        )
        * 0.08;


      /*
       * Slightly faster than our old shader experiments.
       * Smooth, but it shouldn't lag behind the user.
       */

      currentStage.current +=
        (
          targetStage.current -
          currentStage.current
        )
        * 0.075;


      uniforms.uTime.value =
        clock.elapsedTime;


      uniforms.uScroll.value =
        currentScroll.current;


      uniforms.uStage.value =
        currentStage.current;


      uniforms.uMouse.value.copy(
        currentMouse.current
      );
    }
  );


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
        vertexShader={
          vertexShader
        }
        fragmentShader={
          fragmentShader
        }
        uniforms={
          uniforms
        }
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


/* =========================================================
   DISTANT PARTICLE DEPTH
   ========================================================= */

function AmbientDust() {

  const points =
    useRef<THREE.Points>(
      null
    );


  const geometry =
    useMemo(() => {

      const count =
        750;


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
          )
          * 18;


        positions[
          i * 3 + 1
        ] =
          (
            Math.random() -
            0.5
          )
          * 10;


        positions[
          i * 3 + 2
        ] =
          -2
          -
          Math.random()
          * 4;
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
        delta
        * 0.0023;


      points.current.rotation.y +=
        delta
        * 0.0013;
    }
  );


  return (
    <points
      ref={points}
      geometry={geometry}
    >
      <pointsMaterial
        size={0.018}
        color="#89919f"
        transparent
        opacity={0.16}
        depthWrite={false}
      />
    </points>
  );
}


/* =========================================================
   CANVAS
   ========================================================= */

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