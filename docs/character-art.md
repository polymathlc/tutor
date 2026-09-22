# Companion character artwork

Twelve original mascot sprites generated for Study Buddy on 2026-09-23 using the built-in `image_gen.imagegen` tool. Each asset was generated in a separate call; the three welcome images established the character identities, and each remaining pose used its character's welcome image as the reference. No external source artwork was used.

## Production assets

Files are in `assets/companions/` and follow `{orbit,pip,nova}-{welcome,thinking,encourage,celebrate}.webp`. All twelve are 512 × 512 WebP with a real alpha channel. Original 1254 × 1254 generated PNGs were resized and format-converted with Pillow (WebP quality 86, method 6, exact transparent-pixel preservation). Background removal, repainting, and artificial transparency were not applied: alpha came from the image generation tool.

Orbit is the teal and cream robot with a golden antenna and chest light. Pip is the orange fox with a cream muzzle and teal neckerchief. Nova is the plum owl with a cream face and golden glasses. The four emotional states support welcomes, thinking/loading, encouragement and celebrations. Animation is applied by the app to these transparent sprites.

## Validation

Each source and delivered image was checked for an alpha channel, alpha extrema of 0 and 255, transparent top-left corner, and a meaningful fully transparent region. Each image was visually reviewed for framing, identity, expression and pose. The PNG sources remain in the generation output directory; only the compact runtime WebP assets are included in the repository.

## Final prompt set

The exact final prompt for each asset is the shared prompt below followed by its asset-specific suffix. For all non-welcome poses, the sole referenced image was that character's welcome PNG.

### Shared prompt

```text
Use case: stylized-concept. Asset type: transparent mascot sprite for a children's tutor learning app. Style: premium soft matte 3D clay illustration, delightfully rounded shapes, tiny friendly charcoal eyes, warm welcoming personality, simple polished silhouette, restrained detail that reads at small sizes, soft studio lighting. Composition: single full-body character centered in square canvas, completely visible with 10 percent clear padding, straight-on three-quarter perspective. Scene/backdrop: genuinely transparent alpha background. Absolutely no background, no checkerboard drawn into image, no solid white canvas, no ground plane or drop shadow. No text, logo, watermark, extra characters or frame. Final image must retain an actual transparent alpha channel.
```

### orbit-welcome.webp

```text
Subject and pose: Character Orbit: an adorable small teal robot, softly rounded rectangular body, warm cream inset face, rounded teal feet and arms, one tiny golden yellow antenna, a small gold circular chest light. Pose: standing happily waving one arm in a welcoming hello, relaxed other arm, subtle smile. Teal and cream with gold accents.
```

### orbit-thinking.webp

```text
Input image 1 role: character identity, colour and 3D material reference. Primary request: create another sprite of exactly the same orbit character, retaining face, body, colors and proportions. Change only the pose/expression: Thinking: head gently tilted, one robot mitten hand under its chin, other arm resting across belly, eyes looking slightly upward with a curious expression. Keep the one golden antenna and gold circular chest light. Keep the entire character in frame with transparent padding. Preserve actual transparent background.
```

### orbit-encourage.webp

```text
Input image 1 role: character identity, colour and 3D material reference. Primary request: create another sprite of exactly the same orbit character, retaining face, body, colors and proportions. Change only the pose/expression: Encouraging: standing with a reassuring happy smile, one robot hand showing a clear friendly thumbs-up and the other resting on its hip. Keep the one golden antenna and gold circular chest light. Keep the entire character in frame with transparent padding. Preserve actual transparent background.
```

### orbit-celebrate.webp

```text
Input image 1 role: character identity, colour and 3D material reference. Primary request: create another sprite of exactly the same orbit character, retaining face, body, colors and proportions. Change only the pose/expression: Celebrating: joyful open-mouth smile, both robot arms lifted high above shoulders in a victory cheer, one knee raised for a little happy hop. Keep the one golden antenna and gold circular chest light. Keep the entire character in frame with transparent padding. Preserve actual transparent background. No confetti or stars; celebration is expressed by character body and face only.
```

### pip-welcome.webp

```text
Subject and pose: Character Pip: an adorable small warm orange fox with large rounded pointy ears, cream muzzle and belly, dark charcoal tiny nose, big fluffy tail with cream tip, teal triangular neckerchief. Chubby cute proportions. Pose: standing upright happily waving one paw in a welcoming hello, relaxed other paw, subtle smile. Warm orange and cream with teal accent.
```

### pip-thinking.webp

```text
Input image 1 role: character identity, colour and 3D material reference. Primary request: create another sprite of exactly the same pip character, retaining face, body, colors and proportions. Change only the pose/expression: Thinking: head gently tilted, one paw under its chin, other paw resting across belly, eyes looking slightly upward with a curious expression. Keep the teal neckerchief and fluffy cream-tipped tail. Keep the entire character in frame with transparent padding. Preserve actual transparent background.
```

### pip-encourage.webp

```text
Input image 1 role: character identity, colour and 3D material reference. Primary request: create another sprite of exactly the same pip character, retaining face, body, colors and proportions. Change only the pose/expression: Encouraging: standing with a reassuring happy smile, one paw showing a friendly thumbs-up and the other resting on its hip. Keep the teal neckerchief and fluffy cream-tipped tail. Keep the entire character in frame with transparent padding. Preserve actual transparent background.
```

### pip-celebrate.webp

```text
Input image 1 role: character identity, colour and 3D material reference. Primary request: create another sprite of exactly the same pip character, retaining face, body, colors and proportions. Change only the pose/expression: Celebrating: joyful open-mouth smile, both paws lifted high above shoulders in a victory cheer, one knee raised for a little happy hop. Keep the teal neckerchief and fluffy cream-tipped tail. Keep the entire character in frame with transparent padding. Preserve actual transparent background. No confetti or stars; celebration is expressed by character body and face only.
```

### nova-welcome.webp

```text
Subject and pose: Character Nova: an adorable small plum purple owl with a rounded plump body, cream heart-shaped face patch and cream tummy, little golden-yellow beak and feet, large tiny-rimmed gold round glasses, rounded wings. Pose: standing happily waving one wing in a welcoming hello, relaxed other wing, sweet smile. Plum purple and cream with gold accents.
```

### nova-thinking.webp

```text
Input image 1 role: character identity, colour and 3D material reference. Primary request: create another sprite of exactly the same nova character, retaining face, body, colors and proportions. Change only the pose/expression: Thinking: head gently tilted, one wing tip under its beak as if pondering, other wing resting at side, eyes looking slightly upward with a curious expression. Keep the gold round glasses. Keep the entire character in frame with transparent padding. Preserve actual transparent background.
```

### nova-encourage.webp

```text
Input image 1 role: character identity, colour and 3D material reference. Primary request: create another sprite of exactly the same nova character, retaining face, body, colors and proportions. Change only the pose/expression: Encouraging: standing proudly, warm happy smile, one wing lightly raised outward in a supportive reassuring gesture, other wing on its hip. Keep the gold round glasses. Wings remain feathered wings. Keep the entire character in frame with transparent padding. Preserve actual transparent background.
```

### nova-celebrate.webp

```text
Input image 1 role: character identity, colour and 3D material reference. Primary request: create another sprite of exactly the same nova character, retaining face, body, colors and proportions. Change only the pose/expression: Celebrating: joyful open-beak smile, both feathered wings lifted high and out in a victory cheer, one little foot slightly raised as if doing a happy hop. Keep the gold round glasses. Keep the entire character in frame with transparent padding. Preserve actual transparent background. No confetti or stars; celebration is expressed by character body and face only.
```
