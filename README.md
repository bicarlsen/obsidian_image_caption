# Obsidian Image Caption

### Add captions to your images.

![Obsidian Image Caption example](./example.png)

## Use

Use the pipe (|) after the the source of an embeded image to display the text as a caption of the figure.

e.g.
```markdown
![[my_amazing_image.png|Check out this amazing picture.]]
```

## Settings

+ **Label:** Text that prepends all captions.<br/>
For automatic numbering use '#'. If a '#' character is meant to be output, escape it with a backslash ('\'), i.e. '\\#'. Backslashes must also be escaped to be output, i.e.'\\\\'.

+ **CSS:** Apply custom CSS styling to the image captions.<br/>
Captions are indexed from 1 using the 'data-image-caption-index' attribute for styling based on figure number.

## FAQ

+ **My captions aren't showing up:** Captions are only added if the image is rerendered. Try changing the caption (needs to be more than a trialing space) and trying again. If this fixes the issue then change it back, otherwise open an Issue.


## Known issues

+ Only works on internally linked images, not externally linked ones.