import * as THREE from 'three';
import * as ExtendMat from './ExtendMaterial.module.js';
import * as SimplexShader from './simplexNoiseShader.glsl.js';

const getMaterial = function (rockTex1, rockNorm1, rockTex2, rockNorm2) {
    return ExtendMat.extendMaterial(THREE.MeshStandardMaterial, {

        // Will be prepended to vertex and fragment code
        header: `
            varying vec4 vPos;
            varying vec3 vNorm;
            varying vec3 modelPos;
            uniform sampler2D tex1;
            uniform sampler2D tex2;
            uniform sampler2D norm1;
            uniform sampler2D norm2;
            uniform float scale;
            uniform float textureSwapScale;
            uniform float textureSwapBlend;
            uniform float blendFac;
            uniform float fullBright;
            uniform float gridShown;
        ` + SimplexShader.chunk,
    
        // Will be prepended to vertex code
        headerVertex: '',
    
        // Will be prepended to fragment code
        headerFragment: `
        `,
    
        // If desired, the material class to create can be defined such as RawShaderMaterial or ShaderMaterial, by
        // default in order to seamlessly work with in-built features the CustomMaterial class provided by this
        // plugin is used which is a slightly extended ShaderMaterial.
        // class: THREE.ShaderMaterial,
    
        // Insert code lines by hinting at a existing
        vertex: {
    
            // Inserts the line after #include <fog_vertex>
    
            '#include <fog_vertex>': `
                vPos = modelMatrix * vec4(position, 1.0);
                vNorm = normalize(normal);
                modelPos = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );`
    
        },
        fragment: {
            '@#include <map_fragment>' : `
                float worldNoise = clamp((snoise(vPos.xyz * textureSwapScale) + 1.0) / 2.0 * textureSwapBlend - textureSwapBlend/2.0, 0.0, 1.0);

                vec3 modPos = mod(vPos.xyz * scale, vec3(1.0));
    
                vec3 blend = pow( abs(vNorm), vec3(blendFac) );

                #ifdef USE_MAP
                    
                    vec4 x = texture( tex1, modPos.zy );
                    vec4 y = texture( tex1, modPos.xz );
                    vec4 z = texture( tex1, modPos.xy );

                    vec4 x2 = texture( tex2, modPos.zy );
                    vec4 y2 = texture( tex2, modPos.xz );
                    vec4 z2 = texture( tex2, modPos.xy );

                    x = mix(x, x2, worldNoise);
                    y = mix(y, y2, worldNoise);
                    z = mix(z, z2, worldNoise);
                
                    vec3 triplaneColor = (x.xyz * blend.x + y.xyz * blend.y + z.xyz * blend.z) / (blend.x + blend.y + blend.z);

                    vec4 sampledDiffuseColor = vec4(triplaneColor, 1.0);
                    #ifdef DECODE_VIDEO_TEXTURE
                        // inline sRGB decode (TODO: Remove this code when https://crbug.com/1256340 is solved)
                        sampledDiffuseColor = vec4( mix( pow( sampledDiffuseColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), sampledDiffuseColor.rgb * 0.0773993808, vec3( lessThanEqual( sampledDiffuseColor.rgb, vec3( 0.04045 ) ) ) ), sampledDiffuseColor.w );
                    #endif
                    diffuseColor *= sampledDiffuseColor;
                #endif
            `,

            '@#include <normal_fragment_maps>': `
    
                #ifdef OBJECTSPACE_NORMALMAP
                    normal = texture2D( normalMap, vUv ).xyz * 2.0 - 1.0; // overrides both flatShading and attribute normals
                    #ifdef FLIP_SIDED
                        normal = - normal;
                    #endif
                    #ifdef DOUBLE_SIDED
                        normal = normal * faceDirection;
                    #endif
                    normal = normalize( normalMatrix * normal );
                #elif defined( TANGENTSPACE_NORMALMAP )
                    // Whiteout blend
                    // Triplanar uvs
                    vec2 uvX = modPos.zy; // x facing plane
                    vec2 uvY = modPos.xz; // y facing plane
                    vec2 uvZ = modPos.xy; // z facing plane
                    // Tangent space normal maps
                    vec3 tnormalX = texture(norm1, uvX).xyz;
                    vec3 tnormalY = texture(norm1, uvY).xyz;
                    vec3 tnormalZ = texture(norm1, uvZ).xyz;

                    vec3 tnormalX2 = texture(norm2, uvX).xyz;
                    vec3 tnormalY2 = texture(norm2, uvY).xyz;
                    vec3 tnormalZ2 = texture(norm2, uvZ).xyz;

                    tnormalX = mix(tnormalX, tnormalX2, worldNoise);
                    tnormalY = mix(tnormalY, tnormalY2, worldNoise);
                    tnormalZ = mix(tnormalZ, tnormalZ2, worldNoise);
                    // Swizzle world normals into tangent space and apply Whiteout blend
                    tnormalX = vec3(
                        tnormalX.xy + normal.zy,
                        abs(tnormalX.z) * normal.x
                    );
                    tnormalY = vec3(
                        tnormalY.xy + normal.xz,
                        abs(tnormalY.z) * normal.y
                    );
                    tnormalZ = vec3(
                        tnormalZ.xy + normal.xy,
                        abs(tnormalZ.z) * normal.z
                    );
                    // Swizzle tangent normals to match world orientation and triblend
                    vec3 worldNormal = normalize(
                        tnormalX.zyx * blend.x +
                        tnormalY.xzy * blend.y +
                        tnormalZ.xyz * blend.z
                    );
    
                    #ifdef USE_TANGENT
                        normal = normalize( vTBN * mapN );
                    #else
                        normal = worldNormal;
                    #endif
                #elif defined( USE_BUMPMAP )
                    normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
                #endif
            `,
    
            '#include <dithering_fragment>': `
                gl_FragColor.xyz = mix(gl_FragColor.xyz, triplaneColor, fullBright) + gridShown * modelPos;
                //gl_FragColor.xyz = worldNormal;
                gl_FragColor.a = 1.0;`
        },
    
    
        // Properties to apply to the new THREE.ShaderMaterial
        material: {
            map: rockTex1,
            normalMap: rockNorm1,
            metalness: 1,
            roughness: 0.1,
            fog: true
        },
    
    
        // Uniforms (will be applied to existing or added) as value or uniform object
        uniforms: { 
            scale: {value: 0.04},
            textureSwapScale: {value: 10},
            textureSwapBlend: {value: 20},
            blendFac: {value: 10},
            fullBright: {value: 0},
            gridShown: {value: 0},
            tex1: {
                type: "t",
                value: rockTex1
            },
            tex2: {
                type: "t",
                value: rockTex2
            },
            norm1: {
                type: "t",
                value: rockNorm1
            },
            norm2: {
                type: "t",
                value: rockNorm2
            },
            map: {
                type: "t",
                value: rockTex1
            },
            normalMap: {
                type: "t",
                value: rockNorm1
            },
            metalness: {value: 0.4},
            roughness: {value: 0.7},
        }
    
    });
}

export {getMaterial}