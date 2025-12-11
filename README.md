# Fourier Series Visualizer

This project is a small interactive tool that demonstrates how periodic signals can be represented as sums of sinusoidal components using Fourier series. It visualizes the approximation of square and sawtooth waves as the number of Fourier terms increases.

## Motivation

In  Engineering, many systems, from communication signals to control systems—are analyzed in the frequency domain. I built this project to connect my self-study in electromagnetism, signal processing, and applied mathematics with a concrete, visual example. It fits naturally with the “systems thinking” approach I use across my work: break a complex signal into simple components, understand each one, and reconstruct the whole with clarity.

## Mathematics

For a square wave of period \( 2\pi \), the Fourier approximation with \( N \) terms is:

\[
f_N(x) = \frac{4}{\pi} \sum_{k=0}^{N-1} \frac{1}{2k+1} \sin((2k+1)x)
\]

For a sawtooth wave:

\[
f_N(x) = -\frac{2}{\pi} \sum_{n=1}^{N} \frac{1}{n} \sin(nx)
\]

As \( N \) increases, the series converges to the target waveform, and the Gibbs overshoot becomes visible near discontinuities.

## Implementation

The project is written in JavaScript using an HTML canvas and samples the interval \([- \pi, \pi]\). For each x-value, it computes both the ideal waveform and the N-term Fourier approximation, then plots them together. The user can adjust the number of terms and the waveform type interactively.

## Connection to my learning

This project extends the numerical and visualization techniques I used in my electromagnetism portfolio. It demonstrates how mathematical structures relate to real engineering systems and prepares me for topics in signal processing, communication theory, and circuits in Electrical Engineering.
