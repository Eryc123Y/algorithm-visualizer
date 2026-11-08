// algoviz for Typst: step-by-step figures of algorithms and data structures.
//
// The algoviz engine runs inside a WebAssembly plugin (QuickJS-ng), so a
// figure is the same SVG that `algoviz export` writes, with text drawn as
// outlines of the bundled fonts.

// The engine, loaded once. Typst memoizes the transition, so editors and
// watch mode load it once per session.
#let _engine = plugin.transition(
  plugin("plugin.wasm").load,
  read("engine.bc", encoding: none),
)

// Sends a request to the engine and returns its response, a dictionary.
#let _render(request) = json(_engine.render(bytes(json.encode(
  request,
  pretty: false,
))))

// The source of a request: an algorithm id with its input, or a document.
#let _source(name, source, args) = {
  let named = args.named()
  if named.len() > 0 {
    panic(name + ": unexpected argument `" + named.keys().first() + "`")
  }
  let rest = args.pos()
  if type(source) == str {
    if rest.len() != 1 {
      panic(
        name
          + ": `"
          + source
          + "` takes its input as the second argument, such as "
          + name
          + "(\"bst.delete\", (from: (8, 3, 10), key: 3)); pass a document as a dictionary, such as json(\"doc.json\")",
      )
    }
    (algorithm: source, input: rest.first())
  } else if type(source) == dictionary {
    if rest.len() != 0 {
      panic(name + ": a document takes no input")
    }
    (document: source)
  } else {
    panic(
      name
        + ": expected an algorithm id (a string) or a document (a dictionary), not "
        + repr(type(source)),
    )
  }
}

// Checks one selector of ADR 0020: a frame number or text.
#let _selector(name, argument, value) = {
  if type(value) not in (int, str) {
    panic(
      name
        + ": `"
        + argument
        + "` takes a frame number or a step such as \"relax#3\", not "
        + repr(type(value)),
    )
  }
  value
}

// The selectors of a series: `auto` for every frame, one selector, or an
// array of them.
#let _selectors(name, steps) = {
  if steps == auto { () } else if type(steps) == array {
    steps.map(s => _selector(name, "steps", s))
  } else { (_selector(name, "steps", steps),) }
}

#let _theme(name, theme) = {
  if type(theme) != str {
    panic(name + ": `theme` takes a name such as \"dark\", not " + repr(type(theme)))
  }
  theme
}

// What the engine reported, as a box in place of the figure, or as a
// compile error when `strict` is true. The box holds the diagnostics as
// metadata labelled <algoviz-error>, so `query(<algoviz-error>)` lists them.
#let _failure(name, diagnostics, strict) = {
  let line(d) = (
    d.code + " at " + d.path + ": " + d.message
      + if "hint" in d { " " + d.hint } else { "" }
  )
  if strict {
    panic(name + ": " + diagnostics.map(line).join("; "))
  }
  block(
    width: 100%,
    inset: 8pt,
    radius: 3pt,
    stroke: 0.75pt + rgb("#b42318"),
    fill: rgb("#fef3f2"),
    {
      set text(size: 0.85em, fill: rgb("#7a271a"))
      [#metadata(diagnostics) <algoviz-error>]
      strong(name + ": no figure")
      for d in diagnostics {
        linebreak()
        raw(d.code)
        [ at ]
        raw(d.path)
        [: ]
        d.message
        if "hint" in d {
          linebreak()
          emph(d.hint)
        }
      }
    },
  )
}

#let _image(figure, width, height, fit, alt) = image(
  bytes(figure.svg),
  format: "svg",
  width: width,
  height: height,
  fit: fit,
  alt: if alt == auto { figure.at("narration", default: none) } else { alt },
)

/// A figure of one step of an algorithm or a document.
///
/// - source (str, dictionary): A registry id, such as "dijkstra", followed by
///   its input; or a document, such as one read with `json("doc.json")`.
/// - step (int, str): The frame: a number (0 the start, -1 the last), a step
///   such as "relax#3", or a step in a section such as "insert-5/relax#2".
/// - theme (str): "light", "dark" or "print".
/// - strict (bool): Stop compilation on an error, instead of showing it in
///   place of the figure.
/// - width, height, fit, alt: As for `image`; `alt` defaults to the step's
///   narration.
/// -> content
#let algoviz(
  source,
  ..args,
  step: -1,
  theme: "light",
  strict: false,
  width: auto,
  height: auto,
  fit: "contain",
  alt: auto,
) = {
  let request = _source("algoviz", source, args)
  let response = _render(request + (
    step: _selector("algoviz", "step", step),
    theme: _theme("algoviz", theme),
  ))
  if response.ok {
    _image(response.figures.first(), width, height, fit, alt)
  } else {
    _failure("algoviz", response.diagnostics, strict)
  }
}

/// Figures of several steps, as an array of images. All figures of a
/// document share one canvas, so they share one scale at one width.
///
/// - steps (auto, int, str, array): `auto` for every frame, or the
///   selectors of `algoviz`'s `step`; a section such as "insert-5" or a
///   range such as "2..5" names several frames.
/// -> array
#let algoviz-series(
  source,
  ..args,
  steps: auto,
  theme: "light",
  strict: false,
  width: auto,
  height: auto,
  fit: "contain",
) = {
  let request = _source("algoviz-series", source, args)
  let response = _render(request + (
    steps: _selectors("algoviz-series", steps),
    theme: _theme("algoviz-series", theme),
  ))
  if response.ok {
    response.figures.map(f => _image(f, width, height, fit, auto))
  } else {
    (_failure("algoviz-series", response.diagnostics, strict),)
  }
}

/// The engine's answer for a series, as data: `(ok: true, frames: n,
/// figures: ((frame:, selector:, width:, height:, narration:, svg:), ..))`,
/// or `(ok: false, diagnostics: ((code:, path:, message:, hint:), ..))`.
/// For captions, custom layouts and slides.
/// -> dictionary
#let algoviz-figures(source, ..args, steps: auto, theme: "light") = {
  let request = _source("algoviz-figures", source, args)
  _render(request + (
    steps: _selectors("algoviz-figures", steps),
    theme: _theme("algoviz-figures", theme),
  ))
}

/// Slides that step through a series, one frame per subslide, with a slide
/// framework's own `only` (ADR 0028). All frames share one box, sized by
/// the first, so the box keeps its size on every subslide.
///
/// - only (function): The framework's `only`, such as polylux's or
///   touying's: it takes a subslide number or a string such as "3-", and a
///   body.
/// - source (str, dictionary): As for `algoviz`.
/// - steps (auto, int, str, array): As for `algoviz-series`.
/// - start (int): The subslide of the first frame. The last frame stays from
///   its subslide on. A series of one frame is the image alone, on every
///   subslide, whatever `start` says.
/// - theme, strict, width, height, fit: As for `algoviz`.
/// -> content
#let algoviz-slides(
  only,
  source,
  ..args,
  steps: auto,
  start: 1,
  theme: "light",
  strict: false,
  width: auto,
  height: auto,
  fit: "contain",
) = {
  if type(only) != function {
    panic(
      "algoviz-slides: the first argument is the slide framework's `only`, such as polylux's or touying's, not "
        + repr(type(only)),
    )
  }
  if type(start) != int or start < 1 {
    panic(
      "algoviz-slides: `start` takes a subslide number from 1, not "
        + repr(start),
    )
  }
  let request = _source("algoviz-slides", source, args)
  let response = _render(request + (
    steps: _selectors("algoviz-slides", steps),
    theme: _theme("algoviz-slides", theme),
  ))
  if not response.ok {
    return _failure("algoviz-slides", response.diagnostics, strict)
  }
  let figures = response.figures
  if figures.len() == 1 {
    return _image(figures.first(), width, height, fit, auto)
  }
  // Each frame resolves its size against the same region as the hidden
  // copy, so relative sizes such as `height: 70%` give one size for all.
  let last = figures.len() - 1
  box({
    hide(_image(figures.first(), width, height, fit, none))
    for (k, figure) in figures.enumerate() {
      let subslides = if k == last { str(start + k) + "-" } else { start + k }
      place(top + left, only(subslides, _image(
        figure,
        width,
        height,
        fit,
        auto,
      )))
    }
  })
}
