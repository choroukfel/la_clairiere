// Comportements de direction composables, inspirés des exemples du dépôt.
// Chaque méthode retourne une force; la locomotion reste dans Vehicle.update().
class SteeringBehaviors {
  // Projection scalaire sur un segment (notion de l'exercice 5-1).
  // Retourne t borné entre 0 et 1 et le point projeté sur [start, end].
  static projectOnSegment(point, start, end) {
    const segment = p5.Vector.sub(end, start);
    const lengthSquared = segment.magSq();
    if (lengthSquared < 0.0001) return { t: 0, point: start.copy(), segment };
    const t = constrain(p5.Vector.sub(point, start).dot(segment) / lengthSquared, 0, 1);
    return { t, point: p5.Vector.add(start, segment.copy().mult(t)), segment };
  }

  static seek(vehicle, target, speed = vehicle.maxSpeed) {
    const destination = target.pos ?? target;
    const desired = p5.Vector.sub(destination, vehicle.pos);
    if (desired.magSq() < 0.0001 || speed <= 0) return createVector(0, 0);
    desired.setMag(speed);
    const steering = p5.Vector.sub(desired, vehicle.vel);
    steering.limit(vehicle.maxForce);
    return steering;
  }

  static arrive(vehicle, target, slowRadius = 95, speed = vehicle.maxSpeed) {
    const destination = target.pos ?? target;
    const distance = p5.Vector.dist(vehicle.pos, destination);
    const desiredSpeed = distance < slowRadius ? speed * distance / slowRadius : speed;
    return SteeringBehaviors.seek(vehicle, destination, desiredSpeed);
  }

  static pursue(vehicle, target, maximumLookAhead = 24) {
    const targetPosition = target.pos ?? target;
    const distance = p5.Vector.dist(vehicle.pos, targetPosition);
    const closingSpeed = Math.max(0.5, vehicle.maxSpeed + (target.vel?.mag() ?? 0) * 0.35);
    const lookAhead = Math.min(maximumLookAhead, distance / closingSpeed);
    const predicted = targetPosition.copy();
    if (target.vel) predicted.add(target.vel.copy().mult(lookAhead));
    return SteeringBehaviors.seek(vehicle, predicted);
  }

  // Poursuite parfaite (exemple 2-PursueEvade_correction) : point d'interception exact si
  // la cible garde sa vitesse. On résout |D + V t| = s t, avec D = cible − poursuivant,
  // V la vitesse de la cible et s la vitesse maximale du poursuivant.
  // Renvoie null si l'interception est impossible (cible plus rapide qui s'éloigne).
  static interceptPoint(pursuer, target) {
    const d = p5.Vector.sub(target.pos, pursuer.pos);
    const v = target.vel ?? createVector(0, 0);
    const s = pursuer.maxSpeed;
    const a = v.dot(v) - s * s;
    const b = 2 * d.dot(v);
    const c = d.dot(d);
    let t;
    if (Math.abs(a) < 1e-9) {
      if (Math.abs(b) < 1e-9) return c === 0 ? target.pos.copy() : null;
      t = -c / b;
    } else {
      const delta = b * b - 4 * a * c;
      if (delta < 0) return null;
      const root = Math.sqrt(delta);
      const candidates = [(-b - root) / (2 * a), (-b + root) / (2 * a)].filter(x => x >= 0);
      if (candidates.length === 0) return null;
      t = Math.min(...candidates);
    }
    if (t < 0) return null;
    return p5.Vector.add(target.pos, v.copy().mult(t));
  }

  // seek vers le point d'interception ; sans interception possible, poursuite prédictive.
  static pursuePerfect(vehicle, target) {
    const point = SteeringBehaviors.interceptPoint(vehicle, target);
    return point ? SteeringBehaviors.seek(vehicle, point) : SteeringBehaviors.pursue(vehicle, target);
  }

  // Ligne de vue : vraie si aucun obstacle ne coupe le segment from → to.
  // (perception : distance du centre de l'obstacle au segment, comparée à son rayon)
  static lineOfSight(from, to, obstacles = []) {
    for (const obstacle of obstacles) {
      const projection = SteeringBehaviors.projectOnSegment(obstacle.pos, from, to);
      if (p5.Vector.dist(projection.point, obstacle.pos) < obstacle.r) return false;
    }
    return true;
  }

  // Cachette la plus proche : derrière chaque obstacle, à l'opposé de la menace
  // (point = obstacle + direction menace → obstacle × (rayon + marge)). null sans obstacle.
  static hidingSpot(vehicle, threat, obstacles = [], margin = 18) {
    const threatPosition = threat.pos ?? threat;
    let best = null;
    for (const obstacle of obstacles) {
      const away = p5.Vector.sub(obstacle.pos, threatPosition);
      if (away.magSq() < 0.0001) continue;
      away.setMag(obstacle.r + (vehicle.r || 0) + margin);
      const point = p5.Vector.add(obstacle.pos, away);
      const distance = p5.Vector.dist(vehicle.pos, point);
      if (!best || distance < best.distance) best = { point, obstacle, distance };
    }
    return best;
  }

  // Hide (Reynolds / Buckland) : rejoindre la cachette la plus proche avec arrive.
  static hide(vehicle, threat, obstacles = [], margin = 18) {
    const spot = SteeringBehaviors.hidingSpot(vehicle, threat, obstacles, margin);
    return spot ? SteeringBehaviors.arrive(vehicle, spot.point, 40) : null;
  }

  static evade(vehicle, threat, maximumLookAhead = 24) {
    const threatPosition = threat.pos ?? threat;
    const distance = p5.Vector.dist(vehicle.pos, threatPosition);
    const lookAhead = Math.min(maximumLookAhead, distance / Math.max(0.5, vehicle.maxSpeed));
    const predicted = threatPosition.copy();
    if (threat.vel) predicted.add(threat.vel.copy().mult(lookAhead));
    return SteeringBehaviors.flee(vehicle, predicted);
  }

  // Fuite de Reynolds : vitesse désirée opposée à la menace, de norme maxSpeed, puis
  // steering = désirée − actuelle (via seek vers le point symétrique de la menace).
  // Le flee() de vehicle.js vaut −seek() : il s'annule quand l'agent fonce déjà
  // vers la menace à pleine vitesse ; vehicle.js reste celui du cours.
  static flee(vehicle, threat) {
    const threatPosition = threat.pos ?? threat;
    const away = p5.Vector.sub(vehicle.pos, threatPosition);
    if (away.magSq() < 0.0001) return createVector(0, 0);
    return SteeringBehaviors.seek(vehicle, p5.Vector.add(vehicle.pos, away));
  }

  // Freinage : vitesse désirée nulle, donc steering = −vitesse, limité à maxForce.
  // Remplace les remises à zéro directes de la vitesse.
  static brake(vehicle) {
    const steering = vehicle.vel.copy().mult(-1);
    steering.limit(vehicle.maxForce);
    return steering;
  }

  static wander(vehicle, turnRange = 0.035) {
    vehicle.wanderHeading = (vehicle.wanderHeading ?? 0) + random(-turnRange, turnRange);
    const heading = vehicle.vel.magSq() > 0.001 ? vehicle.vel.heading() : vehicle.wanderHeading;
    const desired = p5.Vector.fromAngle(heading + vehicle.wanderHeading * 0.2);
    desired.setMag(vehicle.maxSpeed);
    const steering = p5.Vector.sub(desired, vehicle.vel);
    steering.limit(vehicle.maxForce);
    return steering;
  }

  static separate(vehicle, neighbors, radius = vehicle.r * 3) {
    const sum = createVector(0, 0);
    let count = 0;
    for (const other of neighbors) {
      if (other === vehicle) continue;
      const offset = p5.Vector.sub(vehicle.pos, other.pos);
      const distance = offset.mag();
      if (distance <= 0.001 || distance >= radius) continue;
      offset.normalize().div(distance);
      sum.add(offset);
      count++;
    }
    if (!count || sum.magSq() < 0.0001) return createVector(0, 0);
    sum.div(count).setMag(vehicle.maxSpeed);
    const steering = p5.Vector.sub(sum, vehicle.vel);
    steering.limit(vehicle.maxForce);
    return steering;
  }

  static align(vehicle, neighbors, radius = 100) {
    const average = createVector(0, 0);
    let count = 0;
    for (const other of neighbors) {
      if (other === vehicle || p5.Vector.dist(vehicle.pos, other.pos) >= radius) continue;
      average.add(other.vel);
      count++;
    }
    if (!count || average.magSq() < 0.0001) return createVector(0, 0);
    average.div(count).setMag(vehicle.maxSpeed);
    const steering = p5.Vector.sub(average, vehicle.vel);
    steering.limit(vehicle.maxForce);
    return steering;
  }

  static cohesion(vehicle, neighbors, radius = 120) {
    const center = createVector(0, 0);
    let count = 0;
    for (const other of neighbors) {
      if (other === vehicle || p5.Vector.dist(vehicle.pos, other.pos) >= radius) continue;
      center.add(other.pos);
      count++;
    }
    if (!count) return createVector(0, 0);
    center.div(count);
    return SteeringBehaviors.seek(vehicle, center, vehicle.maxSpeed * 0.72);
  }

  static followPath(vehicle, points, lookAhead = 50, pathRadius = 34) {
    if (!points || points.length < 2) return createVector(0, 0);
    let heading = vehicle.vel.copy();
    if (heading.magSq() < 0.001) heading.set(1, 0);
    heading.normalize().mult(lookAhead);
    const future = p5.Vector.add(vehicle.pos, heading);
    let closest = null;
    let closestTangent = null;
    let shortest = Infinity;

    for (let index = 0; index < points.length; index++) {
      const start = points[index];
      const end = points[(index + 1) % points.length];
      const projection = SteeringBehaviors.projectOnSegment(future, start, end);
      if (projection.segment.magSq() < 0.001) continue;
      const distance = p5.Vector.dist(future, projection.point);
      if (distance >= shortest) continue;
      shortest = distance;
      closest = projection.point;
      closestTangent = projection.segment.normalize();
    }

    if (!closest || !closestTangent || shortest <= pathRadius) return createVector(0, 0);
    const pathTarget = closest.add(closestTangent.mult(lookAhead * 0.7));
    return SteeringBehaviors.seek(vehicle, pathTarget);
  }

  static avoidObstacle(vehicle, target, obstacles) {
    if (!obstacles?.length) return null;
    let heading = vehicle.vel.copy();
    if (heading.magSq() < 0.002) heading = p5.Vector.sub(target.pos ?? target, vehicle.pos);
    if (heading.magSq() < 0.002) return null;
    heading.normalize();

    let nearestThreat = null;
    let nearestProjection = Infinity;
    for (const obstacle of obstacles) {
      const toObstacle = p5.Vector.sub(obstacle.pos, vehicle.pos);
      const projection = toObstacle.dot(heading);
      const lookAhead = Math.max(38, vehicle.vel.mag() * 16 + obstacle.r);
      if (projection <= 0 || projection > lookAhead) continue;
      const closestPoint = p5.Vector.add(vehicle.pos, heading.copy().mult(projection));
      const offset = p5.Vector.sub(closestPoint, obstacle.pos);
      if (offset.mag() < obstacle.r + vehicle.r + 8 && projection < nearestProjection) {
        nearestThreat = { offset, toObstacle };
        nearestProjection = projection;
      }
    }

    if (!nearestThreat) return null;
    const away = nearestThreat.offset;
    if (away.magSq() < 0.001) {
      const side = heading.x * nearestThreat.toObstacle.y - heading.y * nearestThreat.toObstacle.x;
      away.set(-heading.y, heading.x).mult(side >= 0 ? -1 : 1);
    }
    away.setMag(vehicle.maxSpeed);
    const steering = p5.Vector.sub(away, vehicle.vel);
    steering.limit(vehicle.maxForce);
    return steering;
  }

  static combine(vehicle, forces) {
    const combined = createVector(0, 0);
    for (const { force, weight = 1 } of forces) {
      if (force && weight !== 0) combined.add(force.copy().mult(weight));
    }
    combined.limit(vehicle.maxForce);
    return combined;
  }
}
