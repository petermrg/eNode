-- phpMyAdmin SQL Dump
-- version 3.3.8
-- http://www.phpmyadmin.net
--
-- Servidor: localhost
-- Tiempo de generación: 09-02-2013 a las 13:06:17
-- Versión del servidor: 5.5.29
-- Versión de PHP: 5.4.6-1ubuntu1.1

SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8 */;

--
-- Base de datos: `enode`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `clients`
--

CREATE TABLE IF NOT EXISTS `clients` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `hash` binary(16) NOT NULL,
  `id_ed2k` int(10) unsigned NOT NULL,
  `ipv4` int(10) unsigned NOT NULL,
  `port` smallint(5) unsigned NOT NULL,
  `time_login` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `online` tinyint(1) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `hash` (`hash`),
  KEY `id_ed2k` (`id_ed2k`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=188 ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `files`
--

CREATE TABLE IF NOT EXISTS `files` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `hash` binary(16) NOT NULL,
  `size` bigint(20) NOT NULL,
  `time_creation` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `time_offer` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `source_id` int(10) unsigned NOT NULL,
  `source_port` smallint(5) unsigned NOT NULL,
  `sources` int(11) NOT NULL,
  `completed` int(11) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `hash_size` (`hash`,`size`),
  KEY `hash` (`hash`),
  KEY `size` (`size`),
  KEY `time_creation` (`time_creation`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=55629 ;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `sources`
--

CREATE TABLE IF NOT EXISTS `sources` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `id_file` bigint(20) unsigned NOT NULL,
  `id_client` bigint(20) unsigned NOT NULL,
  `name` varchar(255) NOT NULL,
  `ext` varchar(8) NOT NULL,
  `time_offer` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `type` enum('Image','Audio','Video','Pro','Doc') NOT NULL,
  `rating` tinyint(2) unsigned NOT NULL,
  `title` varchar(128) NOT NULL,
  `artist` varchar(128) NOT NULL,
  `album` varchar(128) NOT NULL,
  `length` int(8) unsigned NOT NULL,
  `bitrate` int(8) unsigned NOT NULL,
  `codec` varchar(32) NOT NULL,
  `online` tinyint(1) NOT NULL,
  `complete` tinyint(1) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id_file+id_client` (`id_file`,`id_client`),
  KEY `id_file` (`id_file`),
  KEY `id_client` (`id_client`),
  KEY `time_offer` (`time_offer`),
  KEY `online` (`online`),
  KEY `complete` (`complete`),
  KEY `ext` (`ext`),
  KEY `type` (`type`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=62010 ;

--
-- Filtros para las tablas descargadas (dump)
--

--
-- Filtros para la tabla `sources`
--
ALTER TABLE `sources`
  ADD CONSTRAINT `sources_ibfk_1` FOREIGN KEY (`id_file`) REFERENCES `files` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `sources_ibfk_2` FOREIGN KEY (`id_client`) REFERENCES `clients` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
