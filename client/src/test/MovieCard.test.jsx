import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { MovieCard } from '../components/movies/MovieCard.jsx';

describe('MovieCard Component', () => {
  const mockMovie = {
    _id: 'mock_movie_1',
    title: 'Interstellar Cinema',
    slug: 'interstellar-cinema',
    posterUrl: 'https://example.com/poster.jpg',
    duration: 169,
    certification: 'UA',
    genres: ['Sci-Fi', 'Adventure'],
    languages: ['English'],
    rating: 9.2,
    status: 'now_showing'
  };

  it('renders movie title, certification, duration, and book tickets button', () => {
    render(
      <BrowserRouter>
        <MovieCard movie={mockMovie} />
      </BrowserRouter>
    );

    expect(screen.getByText('Interstellar Cinema')).toBeInTheDocument();
    expect(screen.getByText('UA')).toBeInTheDocument();
    expect(screen.getByText(/169m/)).toBeInTheDocument();
    expect(screen.getByText('Sci-Fi / Adventure')).toBeInTheDocument();
    expect(screen.getByText('Book Tickets')).toBeInTheDocument();
  });

  it('renders COMING SOON badge and View Details button for unreleased movies', () => {
    const comingSoonMovie = {
      ...mockMovie,
      _id: 'mock_movie_2',
      title: 'Quantum Abyss',
      status: 'coming_soon'
    };

    render(
      <BrowserRouter>
        <MovieCard movie={comingSoonMovie} />
      </BrowserRouter>
    );

    expect(screen.getByText('Quantum Abyss')).toBeInTheDocument();
    expect(screen.getByText('COMING SOON')).toBeInTheDocument();
    expect(screen.getByText('View Details')).toBeInTheDocument();
    expect(screen.queryByText('Book Tickets')).not.toBeInTheDocument();
  });
});
